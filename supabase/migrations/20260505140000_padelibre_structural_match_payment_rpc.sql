-- Alinear payments.status con estados usados en la app (invited, expired en cron).
alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (
    status in (
      'pending',
      'approved',
      'rejected',
      'refunded',
      'cancelled',
      'refund_requested',
      'invited',
      'expired'
    )
  );

create index if not exists payments_match_user_created_idx
  on public.payments (match_id, user_id, created_at desc);

-- Unión atómica al partido (flujo público con equipo elegido).
create or replace function public.join_match_atomic(
  p_match_id uuid,
  p_player_id uuid,
  p_team smallint
)
returns table (
  ok boolean,
  reason text,
  participant_count int,
  match_status_out text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ms text;
  v_count int;
  v_t1 int;
  v_t2 int;
  v_owner uuid;
begin
  select match_status, owner_id into v_ms, v_owner
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    return query select false, 'match_not_found'::text, 0, null::text;
    return;
  end if;

  if auth.uid() is distinct from p_player_id and auth.uid() is distinct from v_owner then
    return query select false, 'forbidden'::text, 0, null::text;
    return;
  end if;

  if p_team is null or p_team not in (1, 2) then
    return query select false, 'bad_team'::text, 0, null::text;
    return;
  end if;

  if lower(coalesce(v_ms, '')) in ('cancelled', 'full') then
    return query select false, 'match_closed'::text, 0, v_ms;
    return;
  end if;

  select
    count(*) filter (where team = 1),
    count(*) filter (where team = 2)
  into v_t1, v_t2
  from public.match_participants
  where match_id = p_match_id;

  if (p_team = 1 and coalesce(v_t1, 0) >= 2) or (p_team = 2 and coalesce(v_t2, 0) >= 2) then
    return query select false, 'team_full'::text, 0, v_ms;
    return;
  end if;

  select count(*)::int into v_count
  from public.match_participants
  where match_id = p_match_id;

  if coalesce(v_count, 0) >= 4 then
    return query select false, 'match_full'::text, 0, v_ms;
    return;
  end if;

  if exists (
    select 1
    from public.match_participants
    where match_id = p_match_id
      and player_id = p_player_id
  ) then
    select count(*)::int into v_count
    from public.match_participants
    where match_id = p_match_id;

    select match_status into v_ms
    from public.matches
    where id = p_match_id;

    return query select true, 'already_in'::text, v_count, v_ms;
    return;
  end if;

  insert into public.match_participants (match_id, player_id, team)
  values (p_match_id, p_player_id, p_team);

  select count(*)::int into v_count
  from public.match_participants
  where match_id = p_match_id;

  if v_count >= 4 then
    update public.matches
    set match_status = 'full'
    where id = p_match_id
      and lower(coalesce(match_status, '')) <> 'cancelled';
  end if;

  select match_status into v_ms
  from public.matches
  where id = p_match_id;

  return query select true, 'inserted'::text, v_count, v_ms;
end;
$$;

grant execute on function public.join_match_atomic(uuid, uuid, smallint) to authenticated;

-- Confirmación atómica post-webhook MP (service role).
create or replace function public.confirm_participant_payment_atomic(
  p_match_id uuid,
  p_user_id uuid,
  p_mp_payment_id text
)
returns table (
  payment_row_id uuid,
  idempotent_ok boolean,
  participants_after int,
  all_paid boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay record;
  v_team smallint;
  v_count int;
  v_approved int;
  v_parts int;
  v_c1 int;
  v_c2 int;
begin
  perform 1
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  select *
  into v_pay
  from public.payments
  where match_id = p_match_id
    and user_id = p_user_id
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'payment_not_found';
  end if;

  if v_pay.status = 'approved' then
    select count(*)::int into v_parts from public.match_participants where match_id = p_match_id;

    select count(*)::int into v_approved
    from public.match_participants mp
    where mp.match_id = p_match_id
      and (
        select p.status
        from public.payments p
        where p.match_id = p_match_id
          and p.user_id = mp.player_id
        order by p.created_at desc
        limit 1
      ) = 'approved';

    return query
    select
      v_pay.id,
      true,
      v_parts,
      (v_parts >= 4 and v_approved >= 4);
    return;
  end if;

  update public.payments
  set
    status = 'approved',
    mp_payment_id = p_mp_payment_id,
    updated_at = now()
  where id = v_pay.id;

  if not exists (
    select 1
    from public.match_participants
    where match_id = p_match_id
      and player_id = p_user_id
  ) then
    select
      count(*) filter (where team = 1),
      count(*) filter (where team = 2)
    into v_c1, v_c2
    from public.match_participants
    where match_id = p_match_id;

    if coalesce((
      select count(*)::int
      from public.match_participants
      where match_id = p_match_id
        and team = 1
    ), 0) < 2 then
      v_team := 1;
    elsif coalesce((
      select count(*)::int
      from public.match_participants
      where match_id = p_match_id
        and team = 2
    ), 0) < 2 then
      v_team := 2;
    else
      raise exception 'teams_full';
    end if;

    insert into public.match_participants (match_id, player_id, team)
    values (p_match_id, p_user_id, v_team);
  end if;

  select count(*)::int into v_count
  from public.match_participants
  where match_id = p_match_id;

  if v_count >= 4 then
    update public.matches
    set match_status = 'full'
    where id = p_match_id
      and lower(coalesce(match_status, '')) not in ('cancelled', 'reserved');
  end if;

  select count(*)::int into v_parts from public.match_participants where match_id = p_match_id;

  select count(*)::int into v_approved
  from public.match_participants mp
  where mp.match_id = p_match_id
    and (
      select p.status
      from public.payments p
      where p.match_id = p_match_id
        and p.user_id = mp.player_id
      order by p.created_at desc
      limit 1
    ) = 'approved';

  if v_parts >= 4 and v_approved >= 4 then
    update public.matches
    set
      payment_status = 'paid',
      match_status = 'reserved'
    where id = p_match_id;
  end if;

  return query
  select
    v_pay.id,
    false,
    v_parts,
    (v_parts >= 4 and v_approved >= 4);
end;
$$;

grant execute on function public.confirm_participant_payment_atomic(uuid, uuid, text) to service_role;
