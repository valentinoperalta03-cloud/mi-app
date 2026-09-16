-- Marca durable de que una reserva/partido alcanzo la confirmacion.
--
-- Por que hace falta una columna y no alcanza match_status:
--   * un amistoso 'full' vuelve a 'scheduled' cuando el organizador expulsa a un
--     jugador (kickPlayerFromMatch en app/(player)/partidos/[id]/actions.ts),
--   * 'cancelled' borra toda evidencia del estado anterior,
-- asi que el estado actual no responde "esto llego a estar confirmado alguna vez".
--
-- Semantica:
--   RESERVA  -> se setea cuando el pago de la sena queda aprobado (match_status
--               pasa a 'reserved'), sea por webhook de Mercado Pago o por cobro
--               presencial registrado en /admin/cobros.
--   AMISTOSO -> se setea la PRIMERA vez que el partido llega a 4 jugadores
--               (match_status 'full'), dentro de join_match_atomic.
-- Una vez seteado no se borra: es historia del booking, no estado actual.
--
-- matches tiene grants a nivel de tabla para anon/authenticated, asi que la
-- columna nueva los hereda sin grants explicitos.
alter table public.matches
  add column if not exists confirmed_at timestamptz;

comment on column public.matches.confirmed_at is
  'Primera vez que el booking quedo confirmado (sena aprobada o 4to jugador). Nunca se borra ni se pisa.';

-- SIN BACKFILL DELIBERADO. No existe registro historico de cuando cada partido
-- llego a full ni de cuando se aprobo cada sena, y confirmed_at = created_at
-- seria un dato falso. Las filas viejas quedan NULL; el codigo deriva el hecho
-- (no la hora) del estado actual via isBookingConfirmed() en
-- lib/cancellation-policy.ts. Lo unico irrecuperable son los partidos ya
-- cancelados que alguna vez estuvieron confirmados: para esos no hay forma
-- honesta de saberlo y quedan como no confirmados.

-- join_match_atomic: identica a 20260913120000 (definicion vigente en prod)
-- salvo el coalesce que estampa confirmed_at al pasar a 'full'. El coalesce
-- garantiza que un segundo paso por full (tras una expulsion y un nuevo 4to
-- jugador) no pise la confirmacion original.
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

grant execute on function public.join_match_atomic(uuid, uuid, smallint) to authenticated, service_role;
