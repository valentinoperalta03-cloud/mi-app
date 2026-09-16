-- agregarJugadorDesdeAdmin (app/admin/reservas/actions.ts) completaba partidos
-- con un count + insert desde la app: dos jugadores agregados a la vez podian
-- pasar el chequeo de cupo simultaneamente (carrera), y sobre todo el partido
-- llegaba a 4 participantes SIN pasar a 'full' y sin estampar confirmed_at.
-- Un amistoso completado por el club quedaba fuera de la definicion de
-- "confirmado" y por lo tanto fuera de la politica de cancelacion.
--
-- Este RPC hace lo mismo que join_match_atomic pero para un invitado sin cuenta
-- (player_id null + guest_name): un solo bloque con FOR UPDATE, y la misma
-- transicion scheduled -> full + confirmed_at al entrar el cuarto.
--
-- Es SECURITY DEFINER, asi que revalida la pertenencia del partido al club del
-- usuario que llama (court -> club -> owner_id): no alcanza con la validacion
-- que ya hace la action.
create or replace function public.add_guest_to_match_atomic(
  p_match_id uuid,
  p_team smallint,
  p_guest_name text
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
  v_mt text;
  v_court_id uuid;
  v_count int;
  v_team_count int;
  v_is_owner boolean;
begin
  select m.match_status, m.match_type, m.court_id
  into v_ms, v_mt, v_court_id
  from public.matches m
  where m.id = p_match_id
  for update;

  if not found then
    return query select false, 'match_not_found'::text, 0, null::text;
    return;
  end if;

  if p_team is null or p_team not in (1, 2) then
    return query select false, 'bad_team'::text, 0, v_ms;
    return;
  end if;

  -- Solo service_role pasa sin chequeo. auth.uid() null NO identifica a
  -- service_role: anon tambien llega con uid null, y Supabase le da EXECUTE a
  -- anon por default sobre funciones nuevas. Cualquier otro rol tiene que ser
  -- el dueno del club (con uid null el exists da false -> forbidden).
  if coalesce(auth.role(), '') <> 'service_role' then
    select exists (
      select 1
      from public.courts c
      join public.clubs cl on cl.id = c.club_id
      where c.id = v_court_id
        and cl.owner_id = auth.uid()
    ) into v_is_owner;

    if not coalesce(v_is_owner, false) then
      return query select false, 'forbidden'::text, 0, v_ms;
      return;
    end if;
  end if;

  if lower(coalesce(v_mt, '')) <> 'amistoso' then
    return query select false, 'bad_match_type'::text, 0, v_ms;
    return;
  end if;

  if lower(coalesce(v_ms, '')) in ('cancelled', 'full') then
    return query select false, 'match_closed'::text, 0, v_ms;
    return;
  end if;

  select count(*)::int into v_count
  from public.match_participants
  where match_id = p_match_id;

  if coalesce(v_count, 0) >= 4 then
    return query select false, 'match_full'::text, v_count, v_ms;
    return;
  end if;

  select count(*)::int into v_team_count
  from public.match_participants
  where match_id = p_match_id
    and team = p_team;

  if coalesce(v_team_count, 0) >= 2 then
    return query select false, 'team_full'::text, v_count, v_ms;
    return;
  end if;

  insert into public.match_participants (match_id, player_id, team, guest_name)
  values (p_match_id, null, p_team, nullif(btrim(coalesce(p_guest_name, '')), ''));

  select count(*)::int into v_count
  from public.match_participants
  where match_id = p_match_id;

  -- Misma transicion que join_match_atomic: el cuarto jugador confirma la cancha,
  -- sin importar si entro por la app o lo cargo el club.
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

revoke execute on function public.add_guest_to_match_atomic(uuid, smallint, text) from public, anon;
grant execute on function public.add_guest_to_match_atomic(uuid, smallint, text) to authenticated, service_role;
