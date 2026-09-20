-- Torneos V2 · Fase D · Programación real del torneo
-- (Fase D hardening: auditoría posterior, ver notas "HARDENING" abajo)
--
-- Estado verificado antes de esta migración:
--   * tournament_matches ya tiene court_id/scheduled_date/scheduled_time/
--     duration_minutes (Fase A) y ya se proyecta a court_blocks via el
--     trigger tournament_match_sync_court_block.
--   * El scheduler legacy (assignTournamentMatchSlot + getCourtAvailabilityForDate)
--     hacía "leer disponibilidad -> update" en dos pasos separados: no había
--     ventana de carrera contra OTRO partido de torneo con el MISMO horario
--     exacto (el índice único de court_blocks la cerraba igual, a nivel
--     trigger), pero sí quedaba una ventana angosta contra una
--     reserva/turno fijo nuevo insertado justo entre el read y el write, y
--     contra otro partido de torneo con un horario DISTINTO pero superpuesto
--     (el índice único solo compara la tripla exacta court+fecha+hora).
--
-- Esta migración agrega una única RPC, tournament_assign_match_slot, que
-- hace la validación completa (torneo/partido editable, cancha del club,
-- horario de apertura de la cancha, conflicto con reservas/turnos
-- fijos/entrenamientos/otros partidos de torneo) y el UPDATE en la misma
-- transacción de PL/pgSQL. No reimplementa lógica deportiva: solo lee
-- campos ya persistidos y escribe scheduling.
--
-- HARDENING (auditoría posterior a la implementación inicial de Fase D):
--
-- 1) Horario de apertura: la RPC ahora usa EXACTAMENTE la misma cadena de
--    fallback que ya usa el sistema de reservas de jugador
--    (isSlotWithinCourtHours / getClubAvailability, lib/court-slots.ts):
--    franja propia de la cancha ese día -> si no tiene, horario del club
--    (clubs.open_time/close_time) -> si el club tampoco tiene, 09:00-22:30
--    fijo. La versión anterior, cuando la cancha no tenía franjas propias,
--    no aplicaba NINGÚN límite horario ("los torneos no dependen del
--    horario comercial del club") — auditado y descartado: esa no es la
--    regla real del sistema de reservas, era una excepción exclusiva del
--    scheduler de torneos que además podía mostrar en la UI un horario que
--    esta misma RPC iba a rechazar. lib/tournament-availability.ts (la
--    grilla que arma la UI) se actualizó en el mismo cambio para usar
--    buildSlotsForDay con la misma cadena, así que UI y RPC ya no pueden
--    divergir.
--
-- 2) Índice único de court_blocks: court_blocks_court_date_time_key
--    (court_id, blocked_date, blocked_time) es el respaldo duro contra
--    double-booking entre partidos de torneo que ya usa esta RPC (vía el
--    trigger de Fase A). Estaba verificado como existente en PRODUCCIÓN
--    pero NO en ninguna migración trackeada del repo — como la migración de
--    Fase D todavía no se aplicó en ningún ambiente remoto, se agrega acá
--    (forward-only, `if not exists`) para que la infraestructura completa
--    sea reproducible desde cero solo con `supabase db reset` /
--    `migration up`, sin asumir que una base nueva la tiene "por casualidad".
--
-- 3) Concurrencia — auditoría de primitivas existentes (SOLO LECTURA, sin
--    tocar esos subsistemas):
--      * public.matches tiene un EXCLUDE USING gist (court_id WITH =,
--        tsrange(date, date+90min) WITH &&) WHERE status <> 'cancelled'
--        (constraint "sin_partidos_superpuestos") + un unique index de
--        tripla exacta (court_id, scheduled_date, scheduled_time) WHERE
--        status <> 'cancelled' ("unique_court_slot_active"). Es un
--        constraint real, no solo un índice de performance.
--      * public.reservation_holds tiene su propio EXCLUDE por rango
--        (tstzrange) + unique de "un hold pendiente por owner". También
--        real.
--      * public.fixed_slots NO tiene ningún unique/exclude sobre
--        (court_id, day_of_week, start_time): la creación de un turno fijo
--        no está protegida por constraint contra otro turno fijo
--        superpuesto, y mucho menos contra un partido de torneo.
--    CONCLUSIÓN: no existe una primitiva ÚNICA compartida entre los tres
--    escritores (matches / reservation_holds / tournament_matches vía
--    court_blocks) que garantice exclusión real por court+fecha+rango
--    horario a nivel de una sola constraint. Cada subsistema tiene la SUYA,
--    sobre SU PROPIA tabla. Cerrar la ventana de carrera torneo-vs-reserva o
--    torneo-vs-turno-fijo de punta a punta requeriría que el código que
--    inserta en `matches`/`fixed_slots` tomara el MISMO advisory lock (o
--    escribiera en una tabla de ocupación compartida) que esta RPC — eso
--    significa modificar el flujo de reservas de jugador y la generación de
--    turnos fijos, explícitamente fuera de alcance de este hardening
--    (pertenecen a otro flujo/sesión y el pedido es no tocarlos sin
--    entenderlos primero). Documentado en el reporte de Fase D + hardening
--    en vez de resolverlo en silencio.
--
--    Lo que SÍ se cierra acá, unilateralmente y sin tocar nada ajeno: la
--    RPC toma un advisory lock transaccional por (court_id, date) ANTES de
--    chequear conflictos. Esto serializa TODAS las llamadas a esta misma
--    RPC para la misma cancha+fecha (dos torneos, o dos categorías,
--    agendando en simultáneo), incluso cuando piden horarios DISTINTOS pero
--    superpuestos — caso que el índice único de court_blocks, al comparar
--    la tripla exacta, no alcanza a cubrir por sí solo.
--
-- 4) SEGUNDA RONDA DE HARDENING (post-auditoría de reservation_holds y
--    unificación de locks — ver supabase/migrations/20260921100000_occupancy_lock_hardening.sql
--    para el detalle completo de la 2da ronda):
--      a) reservation_holds NO estaba en la lista de conflictos de esta RPC.
--         Un hold 'pending' con expires_at > now() representa una cancha
--         retenida en el checkout de Mercado Pago — ocupación real, aunque
--         todavía no exista ningún match. Se agrega como chequeo nuevo,
--         usando starts_at/ends_at (las columnas reales del hold, no una
--         reconstrucción por hora exacta).
--      b) El advisory lock de esta función usaba `hashtext(...)` (32 bits)
--         mientras que generate_fixed_slot_occurrence (turnos fijos, migración
--         20260916150000) ya tomaba OTRO advisory lock con
--         `hashtextextended('fixed_slot_court_day:'||...)` (64 bits, semilla
--         distinta) para la MISMA idea de "cancha+fecha" — dos claves
--         DISTINTAS para el mismo recurso conceptual, así que nunca se
--         serializaban entre sí. Se reemplaza por una única función
--         compartida, lock_court_day(court_id, date), que ahora usan esta
--         RPC, generate_fixed_slot_occurrence y consume_reservation_hold.
--         No protege por sí sola contra escritores que no la llamen (ver
--         migración 20260921100000 para el estado final de cada writer).

create or replace function public.clock_to_minutes(t time)
returns integer
language sql
immutable
as $$
  select extract(hour from t)::int * 60 + extract(minute from t)::int;
$$;

-- Mismo criterio que parseCloseTimeToMinutes (lib/court-slots.ts): "00:00" y
-- "23:59"+ se tratan como medianoche (1440), para que una franja que cierra
-- "a las 23:59" no descarte el turno 22:30->00:00.
create or replace function public.close_clock_to_minutes(t time)
returns integer
language sql
immutable
as $$
  select case
    when clock_to_minutes(t) = 0 or clock_to_minutes(t) >= 23 * 60 + 59 then 1440
    else clock_to_minutes(t)
  end;
$$;

-- Índice único de producción (ver nota 2 arriba): ahora versionado acá.
-- `if not exists` lo deja como no-op donde ya existe (producción actual).
create unique index if not exists court_blocks_court_date_time_key
  on public.court_blocks (court_id, blocked_date, blocked_time)
  where blocked_date is not null and blocked_time is not null;

-- Primitiva única de serialización por cancha+fecha (ver nota 4b arriba).
-- Mismo hash (hashtextextended, 64 bits, semilla 0) y mismo prefijo de clave
-- para TODOS los writers que la llamen — lock_court_day('court_day:'||court||fecha).
-- No duplicar la fórmula del hash a mano en cada función.
create or replace function public.lock_court_day(p_court_id uuid, p_date date)
returns void
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('court_day:' || p_court_id::text || ':' || p_date::text, 0));
end;
$$;

create or replace function public.tournament_assign_match_slot(
  p_match_id uuid,
  p_court_id uuid,
  p_date date,
  p_time time
)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
  v_tournament record;
  v_club record;
  v_court record;
  v_duration integer;
  v_start_min integer;
  v_end_min integer;
  v_dow integer;
  v_has_ranges boolean;
  v_in_hours boolean;
  v_open_min integer;
  v_close_min integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null then
      return query select false, 'forbidden'; return;
    end if;
  end if;

  select id, tournament_id, status, duration_minutes, court_id
    into v_match
    from public.tournament_matches
    where id = p_match_id
    for update;
  if v_match.id is null then
    return query select false, 'match_not_found'; return;
  end if;

  select id, club_id, status into v_tournament
    from public.tournaments
    where id = v_match.tournament_id;
  if v_tournament.id is null then
    return query select false, 'match_not_found'; return;
  end if;

  if coalesce(auth.role(), '') <> 'service_role' then
    if not exists (
      select 1 from public.clubs c where c.id = v_tournament.club_id and c.owner_id = auth.uid()
    ) then
      return query select false, 'forbidden'; return;
    end if;
  end if;

  if v_tournament.status in ('finished', 'cancelled') then
    return query select false, 'tournament_not_editable'; return;
  end if;
  if v_match.status = 'finished' then
    return query select false, 'match_finished'; return;
  end if;

  select id into v_court from public.courts where id = p_court_id and club_id = v_tournament.club_id;
  if v_court.id is null then
    return query select false, 'invalid_court'; return;
  end if;

  if exists (select 1 from public.club_closed_days where club_id = v_tournament.club_id and closed_date = p_date) then
    return query select false, 'court_closed'; return;
  end if;

  -- Serializa TODAS las llamadas que tomen este mismo lock (torneo, consumo
  -- de hold, generación de turno fijo — ver nota 4b) para la misma
  -- cancha+fecha: sin esto, dos escrituras simultáneas podían pasar el
  -- chequeo de conflicto las dos antes de que ninguna escribiera. Se libera
  -- solo al terminar la transacción (commit o rollback de este llamado).
  perform lock_court_day(p_court_id, p_date);

  v_duration := coalesce(v_match.duration_minutes, 90);
  v_start_min := clock_to_minutes(p_time);
  v_end_min := v_start_min + v_duration;
  v_dow := extract(dow from p_date)::int;

  -- Horario de apertura de la cancha: misma cadena de fallback que
  -- isSlotWithinCourtHours (lib/court-slots.ts) — franja propia de la
  -- cancha ese día; si no tiene, horario del club; si tampoco, 09:00-22:30.
  select exists(
    select 1 from public.court_time_ranges r where r.court_id = p_court_id and r.day_of_week = v_dow
  ) into v_has_ranges;
  if v_has_ranges then
    select exists(
      select 1 from public.court_time_ranges r
      where r.court_id = p_court_id and r.day_of_week = v_dow
        and v_start_min >= clock_to_minutes(r.open_time)
        and v_end_min <= close_clock_to_minutes(r.close_time)
    ) into v_in_hours;
    if not v_in_hours then
      return query select false, 'invalid_time'; return;
    end if;
  else
    select open_time, close_time into v_club
      from public.clubs where id = v_tournament.club_id;
    if v_club.open_time is not null and v_club.close_time is not null
       and close_clock_to_minutes(v_club.close_time) > clock_to_minutes(v_club.open_time) then
      v_open_min := clock_to_minutes(v_club.open_time);
      v_close_min := close_clock_to_minutes(v_club.close_time);
    else
      v_open_min := 9 * 60;
      v_close_min := 22 * 60 + 30;
    end if;
    if not (v_start_min >= v_open_min and v_end_min <= v_close_min) then
      return query select false, 'invalid_time'; return;
    end if;
  end if;

  -- Reservas / partidos abiertos reales (matches), excepto cancelados y
  -- excepto los que ya son la proyección de un turno fijo (es_turno_fijo:
  -- ese slot ya se valida por su propia fila en fixed_slots más abajo).
  if exists (
    select 1 from public.matches m
    where m.court_id = p_court_id
      and m.scheduled_date = p_date
      and coalesce(m.es_turno_fijo, false) = false
      and coalesce(m.match_status, '') <> 'cancelled'
      and v_start_min < clock_to_minutes(m.scheduled_time) + coalesce(nullif(m.duration_minutes, 0), 90)
      and clock_to_minutes(m.scheduled_time) < v_end_min
  ) then
    return query select false, 'reservation_conflict'; return;
  end if;

  -- Turnos fijos activos ese día de semana, salvo excepción puntual para esta fecha.
  if exists (
    select 1 from public.fixed_slots fs
    where fs.court_id = p_court_id
      and fs.is_active = true
      and fs.day_of_week = v_dow
      and not exists (
        select 1 from public.fixed_slot_exceptions fe
        where fe.fixed_slot_id = fs.id and fe.exception_date = p_date
      )
      and v_start_min < clock_to_minutes(fs.start_time) + coalesce(nullif(fs.duration_minutes, 0), 90)
      and clock_to_minutes(fs.start_time) < v_end_min
  ) then
    return query select false, 'fixed_booking_conflict'; return;
  end if;

  -- Entrenamientos recurrentes activos ese día de semana.
  if exists (
    select 1 from public.training_blocks tb
    where tb.court_id = p_court_id
      and tb.is_active = true
      and tb.day_of_week = v_dow
      and v_start_min < clock_to_minutes(tb.end_time)
      and clock_to_minutes(tb.start_time) < v_end_min
  ) then
    return query select false, 'training_conflict'; return;
  end if;

  -- Bloqueos puntuales y otros partidos de torneo ya agendados (court_blocks
  -- incluye ambos; excluye el bloqueo propio de este mismo partido si ya
  -- tenía uno, para permitir reprogramar).
  if exists (
    select 1 from public.court_blocks cb
    where cb.court_id = p_court_id
      and cb.blocked_date = p_date
      and coalesce(cb.tournament_match_id, '00000000-0000-0000-0000-000000000000'::uuid) <> p_match_id
      and v_start_min < clock_to_minutes(cb.blocked_time) + coalesce(nullif(cb.duration_minutes, 0), 90)
      and clock_to_minutes(cb.blocked_time) < v_end_min
  ) then
    return query select false, 'tournament_match_conflict'; return;
  end if;

  -- Hold de pago vigente (checkout de MP en curso): ocupación real aunque
  -- todavía no exista un match. Usa starts_at/ends_at (columnas reales del
  -- hold), no una reconstrucción por hora exacta.
  declare
    v_start_ts timestamptz;
    v_end_ts timestamptz;
  begin
    v_start_ts := (p_date::text || ' ' || p_time::text)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires';
    v_end_ts := v_start_ts + (v_duration || ' minutes')::interval;
    if exists (
      select 1 from public.reservation_holds h
      where h.court_id = p_court_id
        and h.status = 'pending'
        and h.expires_at > now()
        and tstzrange(h.starts_at, h.ends_at, '[)') && tstzrange(v_start_ts, v_end_ts, '[)')
    ) then
      return query select false, 'reservation_hold_conflict'; return;
    end if;
  end;

  begin
    update public.tournament_matches
    set court_id = p_court_id, scheduled_date = p_date, scheduled_time = p_time
    where id = p_match_id;
  exception when unique_violation then
    return query select false, 'tournament_match_conflict'; return;
  end;

  return query select true, 'ok';
end;
$$;

revoke all on function public.tournament_assign_match_slot(uuid, uuid, date, time) from public, anon;
grant execute on function public.tournament_assign_match_slot(uuid, uuid, date, time) to authenticated, service_role;
