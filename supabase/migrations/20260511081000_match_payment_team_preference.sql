alter table public.payments
  add column if not exists team_preference smallint
  check (team_preference in (1, 2));

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
  v_requested_team smallint;
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
    v_requested_team := null;
    if v_pay.team_preference in (1, 2) then
      v_requested_team := v_pay.team_preference;
    end if;

    if v_requested_team is not null then
      if (
        select count(*)::int
        from public.match_participants
        where match_id = p_match_id
          and team = v_requested_team
      ) < 2 then
        v_team := v_requested_team;
      end if;
    end if;

    if v_team is null then
      if (
        select count(*)::int
        from public.match_participants
        where match_id = p_match_id
          and team = 1
      ) < 2 then
        v_team := 1;
      elsif (
        select count(*)::int
        from public.match_participants
        where match_id = p_match_id
          and team = 2
      ) < 2 then
        v_team := 2;
      else
        raise exception 'teams_full';
      end if;
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
