-- Torneos V2 · Fase D · Integración final con reservas sin seña (ya en producción).
--
-- CONTEXTO: create_direct_reservation e insert_reservation_hold_locked
-- (20260920011329/011345, YA aplicadas en producción) fueron escritas
-- ANTES de que Torneos V2 se deployara, a propósito de forma autocontenida
-- (sin depender de lock_court_day/clock_to_minutes/court_blocks.duration_minutes,
-- que todavía no existían). Sus propios comentarios documentan exactamente
-- este momento: "El día que [lock_court_day] exista, reemplazar la línea
-- ... por 'perform public.lock_court_day(...)' es un cambio mecánico,
-- mismo hash, sin cambio de comportamiento" y "court_blocks no tiene
-- columna de duración en producción hoy — mismo criterio de hora exacta".
--
-- Esta migración hace exactamente esos dos cambios, ahora que ambas
-- dependencias existen (lock_court_day: 20260920100000_tournament_v2_scheduler.sql;
-- court_blocks.duration_minutes: 20260917100000_tournaments_v2_model.sql):
--   1. Reemplaza el pg_advisory_xact_lock inline por una llamada a
--      lock_court_day — MISMA fórmula de hash, cero cambio de comportamiento
--      (documentado como "cambio mecánico" en el código ya desplegado).
--   2. Amplía el chequeo de court_blocks de "hora exacta" a "solapamiento
--      por rango" usando court_blocks.duration_minutes (default 90 si es
--      null, igual que el resto del sistema) — esto SÍ es un cambio de
--      comportamiento real: antes, un torneo de 16:00 a 17:30 no bloqueaba
--      un intento de reserva a las 16:30 (solo coincidencia de hora exacta
--      lo hacía); ahora sí, igual que ya hace tournament_assign_match_slot.
--
-- NO se toca ninguna otra validación, mensaje, columna, monto ni el flujo
-- de Mercado Pago. Las reason codes existentes ('court_blocked') se
-- mantienen sin cambios de nombre — solo se ampliá QUÉ filas matchea.
--
-- Ambas funciones se redefinen con la firma EXACTA ya publicada en
-- producción (mismos parámetros, mismo orden, mismo tipo de retorno) para
-- que ningún caller (reservarCancha) necesite cambiar una sola línea.

-- ---------------------------------------------------------------------------
-- create_direct_reservation (camino sin seña)
-- ---------------------------------------------------------------------------
create or replace function public.create_direct_reservation(
  p_owner_id uuid,
  p_club_id uuid,
  p_court_id uuid,
  p_scheduled_date date,
  p_scheduled_time time,
  p_duration_minutes integer,
  p_total_price numeric,
  p_location_name text
)
returns table (ok boolean, reason text, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_min integer;
  v_duration integer;
  v_active_count integer;
  v_requires_deposit boolean;
  v_has_mp boolean;
  v_match_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_owner_id then
      return query select false, 'forbidden'::text, null::uuid; return;
    end if;
  end if;

  if p_owner_id is null or p_club_id is null or p_court_id is null
     or p_scheduled_date is null or p_scheduled_time is null then
    return query select false, 'bad_input'::text, null::uuid; return;
  end if;
  if p_total_price is null or p_total_price <= 0 then
    return query select false, 'bad_input'::text, null::uuid; return;
  end if;
  v_duration := coalesce(nullif(p_duration_minutes, 0), 90);
  if v_duration < 10 or v_duration > 600 then
    return query select false, 'bad_input'::text, null::uuid; return;
  end if;

  if not exists (
    select 1 from courts c where c.id = p_court_id and c.club_id = p_club_id
  ) then
    return query select false, 'court_not_found'::text, null::uuid; return;
  end if;

  select requires_deposit, (mp_access_token is not null and mp_access_token <> '')
    into v_requires_deposit, v_has_mp
    from clubs where id = p_club_id;
  if v_requires_deposit is null or v_requires_deposit then
    return query select false, 'deposit_required'::text, null::uuid; return;
  end if;
  if not coalesce(v_has_mp, false) then
    return query select false, 'mp_not_connected'::text, null::uuid; return;
  end if;

  -- Antes: pg_advisory_xact_lock(hashtextextended('court_day:'||...)) inline
  -- (mismo hash). Ahora que lock_court_day existe, se usa la función
  -- compartida — mismo lock, cero cambio de comportamiento.
  perform public.lock_court_day(p_court_id, p_scheduled_date);

  v_start_min := (extract(epoch from p_scheduled_time)::integer) / 60;

  -- Bloqueo puntual/torneo por RANGO (antes: solo hora exacta, porque
  -- court_blocks.duration_minutes no existía en producción).
  if exists (
    select 1 from court_blocks cb
    where cb.court_id = p_court_id
      and (
        (cb.blocked_date = p_scheduled_date and cb.blocked_time is not null
          and v_start_min < (extract(epoch from cb.blocked_time)::integer) / 60 + coalesce(nullif(cb.duration_minutes, 0), 90)
          and (extract(epoch from cb.blocked_time)::integer) / 60 < v_start_min + v_duration)
        or
        (cb.date = p_scheduled_date and cb.start_time is not null
          and v_start_min < (extract(epoch from cb.start_time)::integer) / 60 + 90
          and (extract(epoch from cb.start_time)::integer) / 60 < v_start_min + v_duration)
      )
  ) then
    return query select false, 'court_blocked'::text, null::uuid; return;
  end if;

  if exists (
    select 1 from matches m
    where m.court_id = p_court_id
      and m.scheduled_date = p_scheduled_date
      and coalesce(m.match_status, '') <> 'cancelled'
      and v_start_min < (extract(epoch from m.scheduled_time)::integer) / 60
                         + coalesce(nullif(m.duration_minutes, 0), 90)
      and (extract(epoch from m.scheduled_time)::integer) / 60 < v_start_min + v_duration
  ) then
    return query select false, 'slot_conflict'::text, null::uuid; return;
  end if;

  if exists (
    select 1 from reservation_holds h
    where h.court_id = p_court_id
      and h.scheduled_date = p_scheduled_date
      and h.status = 'pending'
      and h.expires_at > now()
      and v_start_min < (extract(epoch from h.scheduled_time)::integer) / 60
                         + coalesce(nullif(h.duration_minutes, 0), 90)
      and (extract(epoch from h.scheduled_time)::integer) / 60 < v_start_min + v_duration
  ) then
    return query select false, 'slot_conflict'::text, null::uuid; return;
  end if;

  if exists (
    select 1 from matches m
    where m.owner_id = p_owner_id
      and m.court_id = p_court_id
      and m.scheduled_date = p_scheduled_date
      and m.scheduled_time = p_scheduled_time
      and coalesce(m.match_status, '') <> 'cancelled'
  ) then
    return query select false, 'already_reserved'::text, null::uuid; return;
  end if;

  if exists (
    select 1 from reservation_holds where owner_id = p_owner_id and status = 'pending' and expires_at > now()
  ) then
    return query select false, 'pending_hold_exists'::text, null::uuid; return;
  end if;

  select count(*) into v_active_count
  from matches
  where owner_id = p_owner_id
    and match_status in ('scheduled', 'reserved', 'full')
    and payment_status in ('paid', 'pending', 'cash_pending', 'transfer_pending', 'club_pending');
  if v_active_count >= 3 then
    return query select false, 'too_many_active'::text, null::uuid; return;
  end if;

  begin
    insert into matches (
      match_type, match_status, payment_status, financial_status,
      total_price, amount_paid, amount_pending, scheduled_date, scheduled_time,
      duration_minutes, court_id, owner_id, location_name, date, confirmed_at
    ) values (
      'reservation', 'reserved', 'club_pending', 'unpaid',
      p_total_price, 0, p_total_price, p_scheduled_date, p_scheduled_time,
      v_duration, p_court_id, p_owner_id, p_location_name,
      p_scheduled_date + p_scheduled_time,
      now()
    )
    returning id into v_match_id;
  exception
    when exclusion_violation then
      return query select false, 'slot_conflict'::text, null::uuid; return;
    when unique_violation then
      return query select false, 'slot_conflict'::text, null::uuid; return;
  end;

  insert into match_participants (match_id, player_id, team)
  values (v_match_id, p_owner_id, 1);

  return query select true, 'ok'::text, v_match_id;
end;
$$;

revoke all on function public.create_direct_reservation(uuid, uuid, uuid, date, time, integer, numeric, text) from public, anon, authenticated;
grant execute on function public.create_direct_reservation(uuid, uuid, uuid, date, time, integer, numeric, text) to service_role;

-- ---------------------------------------------------------------------------
-- insert_reservation_hold_locked (camino con seña)
-- ---------------------------------------------------------------------------
create or replace function public.insert_reservation_hold_locked(
  p_owner_id uuid,
  p_club_id uuid,
  p_court_id uuid,
  p_scheduled_date date,
  p_scheduled_time time,
  p_duration_minutes integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_total_price numeric,
  p_deposit_amount numeric,
  p_location_name text,
  p_expires_at timestamptz
)
returns table (ok boolean, reason text, hold_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_min integer;
  v_duration integer;
  v_hold_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or auth.uid() <> p_owner_id then
      return query select false, 'forbidden'::text, null::uuid; return;
    end if;
  end if;

  if p_owner_id is null or p_club_id is null or p_court_id is null
     or p_scheduled_date is null or p_scheduled_time is null
     or p_starts_at is null or p_ends_at is null or p_expires_at is null then
    return query select false, 'bad_input'::text, null::uuid; return;
  end if;
  v_duration := coalesce(nullif(p_duration_minutes, 0), 90);

  -- Mismo lock que create_direct_reservation (antes inline, ahora compartido).
  perform public.lock_court_day(p_court_id, p_scheduled_date);

  v_start_min := (extract(epoch from p_scheduled_time)::integer) / 60;

  -- Bloqueo puntual/torneo por RANGO (antes: solo hora exacta).
  if exists (
    select 1 from court_blocks cb
    where cb.court_id = p_court_id
      and (
        (cb.blocked_date = p_scheduled_date and cb.blocked_time is not null
          and v_start_min < (extract(epoch from cb.blocked_time)::integer) / 60 + coalesce(nullif(cb.duration_minutes, 0), 90)
          and (extract(epoch from cb.blocked_time)::integer) / 60 < v_start_min + v_duration)
        or
        (cb.date = p_scheduled_date and cb.start_time is not null
          and v_start_min < (extract(epoch from cb.start_time)::integer) / 60 + 90
          and (extract(epoch from cb.start_time)::integer) / 60 < v_start_min + v_duration)
      )
  ) then
    return query select false, 'court_blocked'::text, null::uuid; return;
  end if;

  -- Única revalidación que este wrapper agregaba sobre el flujo legacy en TS:
  -- que no exista una reserva CONFIRMADA que se solape (sin cambios acá).
  if exists (
    select 1 from matches m
    where m.court_id = p_court_id
      and m.scheduled_date = p_scheduled_date
      and coalesce(m.match_status, '') <> 'cancelled'
      and v_start_min < (extract(epoch from m.scheduled_time)::integer) / 60
                         + coalesce(nullif(m.duration_minutes, 0), 90)
      and (extract(epoch from m.scheduled_time)::integer) / 60 < v_start_min + v_duration
  ) then
    return query select false, 'slot_conflict'::text, null::uuid; return;
  end if;

  begin
    insert into reservation_holds (
      owner_id, club_id, court_id, scheduled_date, scheduled_time, duration_minutes,
      starts_at, ends_at, total_price, deposit_amount, location_name, status, expires_at
    ) values (
      p_owner_id, p_club_id, p_court_id, p_scheduled_date, p_scheduled_time, v_duration,
      p_starts_at, p_ends_at, p_total_price, p_deposit_amount, p_location_name, 'pending', p_expires_at
    )
    returning id into v_hold_id;
  exception
    when unique_violation then
      return query select false, 'pending_hold_exists'::text, null::uuid; return;
    when exclusion_violation then
      return query select false, 'slot_conflict'::text, null::uuid; return;
  end;

  return query select true, 'ok'::text, v_hold_id;
end;
$$;

revoke all on function public.insert_reservation_hold_locked(uuid, uuid, uuid, date, time, integer, timestamptz, timestamptz, numeric, numeric, text, timestamptz) from public, anon, authenticated;
grant execute on function public.insert_reservation_hold_locked(uuid, uuid, uuid, date, time, integer, timestamptz, timestamptz, numeric, numeric, text, timestamptz) to service_role;
