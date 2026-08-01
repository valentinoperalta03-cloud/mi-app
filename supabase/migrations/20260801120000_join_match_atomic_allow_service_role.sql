-- join_match_atomic solo permitia auth.uid() = p_player_id o auth.uid() = owner_id.
-- voteOnRequest (aprobacion por mayoria) puede insertar al solicitante en nombre
-- de un participante distinto del dueno cuando ese es el voto que decide, asi
-- que necesita llamarlo con service_role (auth.uid() = null). Se permite null
-- explicitamente en vez de abrir el check a cualquier autenticado, para no
-- debilitar la proteccion contra que un jugador cualquiera inserte a otro.
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

  if auth.uid() is not null and auth.uid() is distinct from p_player_id and auth.uid() is distinct from v_owner then
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

grant execute on function public.join_match_atomic(uuid, uuid, smallint) to authenticated, service_role;
