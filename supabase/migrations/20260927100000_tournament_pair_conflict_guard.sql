-- ---------------------------------------------------------------------------
-- Torneos V2 · Cierre de cadena — seguridad de la programación (punto 3 del
-- pedido de cierre): "una pareja no puede jugar dos partidos a la vez" NO
-- puede vivir solo en el cliente (VisualScheduler/autoScheduleTournamentAction
-- ya lo chequean en TS, pero eso es orientativo — un segundo tab, una llamada
-- directa a la RPC, o una carrera entre dos asignaciones concurrentes lo
-- salteaba sin que nada en el server lo impidiera).
--
-- tournament_assign_match_slot ya valida conflictos POR CANCHA (con lock por
-- court_id+fecha). El conflicto de pareja es distinto: hay que mirar TODAS
-- las canchas de ESE torneo en esa fecha, así que el lock existente
-- (lock_court_day, alcance court_id+fecha) no alcanza para hacer atómico el
-- chequeo. Se agrega un lock ADICIONAL, mismo mecanismo
-- (pg_advisory_xact_lock + hashtextextended, mismo estilo que lock_court_day
-- en 20260920100000_tournament_v2_scheduler.sql), con alcance
-- tournament_id+fecha: serializa TODAS las asignaciones de ese torneo en esa
-- fecha entre sí, sin tocar lock_court_day (queda igual, la siguen usando
-- reservas/turnos fijos sin cambios).
--
-- Orden de locks siempre: primero tournament_id+fecha (más amplio), después
-- court_id+fecha (lock_court_day, ya existente) — mismo orden en el único
-- lugar que toma ambos, sin riesgo de deadlock entre sí.

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

  select id, tournament_id, status, duration_minutes, court_id, pair1_id, pair2_id
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

  -- Lock por TORNEO+fecha (nuevo, ver nota arriba): serializa todas las
  -- asignaciones de este torneo en esta fecha entre sí, sin importar la
  -- cancha — necesario para que el chequeo de "pareja ocupada" de abajo sea
  -- atómico (mira todas las canchas, no solo p_court_id).
  perform pg_advisory_xact_lock(hashtextextended('tournament_day:' || v_match.tournament_id::text || ':' || p_date::text, 0));

  -- Lock por cancha+fecha (ya existente, ver 20260920100000): serializa
  -- además contra reservas/turnos fijos/otros torneos en la MISMA cancha.
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

  -- Pareja ya ocupada: la MISMA pareja (pair1 o pair2 de este partido) no
  -- puede tener OTRO partido de este torneo con horario superpuesto ese día,
  -- en NINGUNA cancha. tournament_assign_match_slot es el único camino de
  -- escritura de horario de torneo (assignTournamentMatchSlot en TS, usado
  -- tanto por el editor visual como por autoScheduleTournamentAction, no
  -- escriben scheduled_date/time por otra vía), así que este chequeo alcanza
  -- para cerrar la garantía acá, no solo en el cliente.
  if (v_match.pair1_id is not null or v_match.pair2_id is not null) and exists (
    select 1 from public.tournament_matches tm2
    where tm2.tournament_id = v_match.tournament_id
      and tm2.id <> p_match_id
      and tm2.scheduled_date = p_date
      and tm2.scheduled_time is not null
      and (
        (v_match.pair1_id is not null and v_match.pair1_id in (tm2.pair1_id, tm2.pair2_id))
        or (v_match.pair2_id is not null and v_match.pair2_id in (tm2.pair1_id, tm2.pair2_id))
      )
      and v_start_min < clock_to_minutes(tm2.scheduled_time) + coalesce(nullif(tm2.duration_minutes, 0), 90)
      and clock_to_minutes(tm2.scheduled_time) < v_end_min
  ) then
    return query select false, 'pair_conflict'; return;
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
