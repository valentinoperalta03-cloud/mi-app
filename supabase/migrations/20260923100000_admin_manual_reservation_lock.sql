-- Torneos V2 · Fase D · Cierre de la deuda documentada: reserva manual del
-- club (crearReservaDesdeAdmin, app/admin/reservas/actions.ts).
--
-- Auditoría (ver reporte de hardening anterior, punto "D"): este writer
-- insertaba directo en `matches` después de un check-then-insert en varios
-- pasos de JS, sin `lock_court_day` y sin revalidar contra
-- `reservation_holds` (un jugador pagando esa misma cancha+horario por MP
-- podía perder la carrera contra una reserva manual cargada por el club, y
-- viceversa). Quedaba protegido matches-vs-matches por el EXCLUDE existente
-- (sin_partidos_superpuestos / unique_court_slot_active), pero no contra
-- torneo (court_blocks) ni contra reservation_holds.
--
-- Mismo patrón que create_reservation_hold: se extrae el tramo crítico
-- (lock -> revalidar -> insertar) a una única RPC transaccional. La lógica
-- que NO es de ocupación (validar inputs, asegurar el profile del club,
-- resolver el precio) se queda en la Server Action, sin cambios.

create or replace function public.admin_create_manual_reservation(
  p_owner_id uuid,
  p_club_id uuid,
  p_court_id uuid,
  p_scheduled_date date,
  p_scheduled_time time,
  p_duration_minutes integer,
  p_total_price numeric,
  p_amount_paid numeric,
  p_amount_pending numeric,
  p_payment_status text,
  p_financial_status text,
  p_match_status text,
  p_manual_reference text
)
returns table (ok boolean, reason text, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_min integer;
  v_match_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_owner_id then
      return query select false, 'forbidden'::text, null::uuid; return;
    end if;
    if not exists (select 1 from public.clubs c where c.id = p_club_id and c.owner_id = auth.uid()) then
      return query select false, 'forbidden'::text, null::uuid; return;
    end if;
  end if;

  if not exists (select 1 from public.courts co where co.id = p_court_id and co.club_id = p_club_id) then
    return query select false, 'invalid_court'::text, null::uuid; return;
  end if;

  -- Mismo lock compartido que tournament_assign_match_slot / create_reservation_hold
  -- / consume_reservation_hold / generate_fixed_slot_occurrence.
  perform public.lock_court_day(p_court_id, p_scheduled_date);

  if exists (
    select 1 from public.club_closed_days d where d.club_id = p_club_id and d.closed_date = p_scheduled_date
  ) then
    return query select false, 'club_closed'::text, null::uuid; return;
  end if;

  v_start_min := clock_to_minutes(p_scheduled_time);

  -- Bloqueo puntual (moderno y legacy) por RANGO — antes solo se chequeaba la
  -- hora exacta desde JS (courtBlockStartsFromRows).
  if exists (
    select 1 from public.court_blocks cb
    where cb.court_id = p_court_id
      and (
        (cb.blocked_date = p_scheduled_date and cb.blocked_time is not null
          and v_start_min < clock_to_minutes(cb.blocked_time) + coalesce(nullif(cb.duration_minutes, 0), 90)
          and clock_to_minutes(cb.blocked_time) < v_start_min + p_duration_minutes)
        or
        (cb.date = p_scheduled_date and cb.start_time is not null
          and v_start_min < clock_to_minutes(cb.start_time) + 90
          and clock_to_minutes(cb.start_time) < v_start_min + p_duration_minutes)
      )
  ) then
    return query select false, 'court_blocked'::text, null::uuid; return;
  end if;

  -- Reservas/partidos reales ya confirmados.
  if exists (
    select 1 from public.matches m
    where m.court_id = p_court_id
      and m.scheduled_date = p_scheduled_date
      and coalesce(m.match_status, '') <> 'cancelled'
      and v_start_min < clock_to_minutes(m.scheduled_time) + coalesce(nullif(m.duration_minutes, 0), 90)
      and clock_to_minutes(m.scheduled_time) < v_start_min + p_duration_minutes
  ) then
    return query select false, 'slot_conflict'::text, null::uuid; return;
  end if;

  -- NUEVO: hold de pago vigente (checkout de un jugador en curso).
  if exists (
    select 1 from public.reservation_holds h
    where h.court_id = p_court_id
      and h.scheduled_date = p_scheduled_date
      and h.status = 'pending'
      and h.expires_at > now()
      and v_start_min < clock_to_minutes(h.scheduled_time) + coalesce(nullif(h.duration_minutes, 0), 90)
      and clock_to_minutes(h.scheduled_time) < v_start_min + p_duration_minutes
  ) then
    return query select false, 'reservation_hold_conflict'::text, null::uuid; return;
  end if;

  insert into public.matches (
    match_type, match_status, payment_status, financial_status, total_price,
    amount_paid, amount_pending, scheduled_date, scheduled_time, duration_minutes,
    court_id, owner_id, manual_reference, es_turno_fijo, date
  ) values (
    'reservation', p_match_status, p_payment_status, p_financial_status, p_total_price,
    p_amount_paid, p_amount_pending, p_scheduled_date, p_scheduled_time, p_duration_minutes,
    p_court_id, p_owner_id, p_manual_reference, false,
    -- date + time -> timestamp SIN conversión de zona horaria (igual que
    -- generate_fixed_slot_occurrence y el fix de consume_reservation_hold en
    -- 20260922100000): nunca pasar por timestamptz acá, matches.date es
    -- `timestamp without time zone`.
    p_scheduled_date + p_scheduled_time
  )
  returning id into v_match_id;

  return query select true, 'ok'::text, v_match_id;
end;
$$;

revoke all on function public.admin_create_manual_reservation(uuid, uuid, uuid, date, time, integer, numeric, numeric, numeric, text, text, text, text) from public, anon;
grant execute on function public.admin_create_manual_reservation(uuid, uuid, uuid, date, time, integer, numeric, numeric, numeric, text, text, text, text) to authenticated, service_role;
