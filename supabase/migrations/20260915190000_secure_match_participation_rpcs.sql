-- Endurecer join_match_atomic y leave_match_atomic.
--
-- Estado verificado en produccion (pg_proc, 2026-09-16):
--   * ambas SECURITY DEFINER con search_path = public;
--   * proacl: {=X/postgres, anon=X, authenticated=X, service_role=X}
--     -> PUBLIC y anon podian ejecutarlas;
--   * la autorizacion era "auth.uid() is not null and ...": con uid NULL (anon)
--     el chequeo se salteaba. Cualquier visitante sin sesion podia anotar o sacar
--     a cualquier jugador de cualquier partido.
--
-- Cuerpos: identicos a 20260915130000 (join) y 20260915140000 (leave), que son
-- las definiciones vigentes en produccion. Solo cambia el bloque de autorizacion:
--   * service_role pasa sin chequeo (solicitudes/actions.ts vota con service client);
--   * cualquier otro rol necesita auth.uid() no nulo y que cumpla la regla legitima
--     (join: el propio jugador o el dueno del partido; leave: el propio jugador).

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
security definer
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

  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null
       or (auth.uid() is distinct from p_player_id and auth.uid() is distinct from v_owner) then
      return query select false, 'forbidden'::text, 0, null::text;
      return;
    end if;
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
    set match_status = 'full',
        confirmed_at = coalesce(confirmed_at, now())
    where id = p_match_id
      and lower(coalesce(match_status, '')) <> 'cancelled';
  end if;

  select match_status into v_ms
  from public.matches
  where id = p_match_id;

  return query select true, 'inserted'::text, v_count, v_ms;
end;
$$;

create or replace function public.leave_match_atomic(
  p_match_id uuid,
  p_player_id uuid
)
returns table (
  match_id uuid,
  owner_before uuid,
  owner_after uuid,
  cancelled boolean,
  slot_released boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_court_id uuid;
  v_scheduled_date date;
  v_scheduled_time time;
  v_count int;
  v_new_owner uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or auth.uid() is distinct from p_player_id then
      raise exception 'forbidden';
    end if;
  end if;

  select m.owner_id, m.court_id, m.scheduled_date, m.scheduled_time
  into v_owner, v_court_id, v_scheduled_date, v_scheduled_time
  from public.matches m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  delete from public.match_participants mp
  where mp.match_id = p_match_id
    and mp.player_id = p_player_id;

  if not found then
    raise exception 'participant_not_found';
  end if;

  select count(*)::int into v_count
  from public.match_participants mp
  where mp.match_id = p_match_id;

  -- El cupo dejo de estar completo: el partido vuelve a buscar jugadores.
  -- Solo revierte 'full'; no toca 'reserved', 'cancelled' ni 'scheduled'.
  if v_count < 4 then
    update public.matches m
    set match_status = 'scheduled'
    where m.id = p_match_id
      and lower(coalesce(m.match_status, '')) = 'full';
  end if;

  if v_owner = p_player_id then
    if v_count = 0 then
      update public.matches m
      set match_status = 'cancelled',
          payment_status = case
            when lower(coalesce(m.match_type, '')) = 'amistoso' then m.payment_status
            else 'cancelled'
          end
      where m.id = p_match_id;

      delete from public.court_blocks cb
      where cb.court_id = v_court_id
        and (
          (cb.blocked_date = v_scheduled_date and cb.blocked_time = v_scheduled_time)
          or (cb.date = v_scheduled_date and cb.start_time = v_scheduled_time)
        );

      return query
      select p_match_id, v_owner, null::uuid, true, true;
    else
      select mp.player_id into v_new_owner
      from public.match_participants mp
      where mp.match_id = p_match_id
      order by mp.created_at nulls last, mp.player_id
      limit 1;

      update public.matches
      set owner_id = v_new_owner
      where id = p_match_id;

      return query
      select p_match_id, p_player_id, v_new_owner, false, false;
    end if;
  end if;

  return query
  select p_match_id, v_owner, v_owner, false, false;
end;
$$;

revoke execute on function public.join_match_atomic(uuid, uuid, smallint) from public;
revoke execute on function public.join_match_atomic(uuid, uuid, smallint) from anon;
grant execute on function public.join_match_atomic(uuid, uuid, smallint) to authenticated, service_role;

revoke execute on function public.leave_match_atomic(uuid, uuid) from public;
revoke execute on function public.leave_match_atomic(uuid, uuid) from anon;
grant execute on function public.leave_match_atomic(uuid, uuid) to authenticated, service_role;
