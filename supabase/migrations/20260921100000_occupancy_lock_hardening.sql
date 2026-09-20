-- Torneos V2 · Fase D · Hardening (2da ronda) — unificación de concurrencia
-- entre TODOS los writers reales de ocupación de cancha.
--
-- Contexto (auditoría, sin tocar nada hasta este punto):
--   Writers reales de ocupación de court+fecha+horario, uno por uno:
--     A. tournament_assign_match_slot (migración 20260920100000) — YA
--        actualizada en esta misma ronda para tomar lock_court_day y
--        revalidar contra reservation_holds.
--     B. Creación de reservation_hold: RESUELTO por otra rama de trabajo
--        (reservas sin seña, commits 90df24b/78d7d6d en origin/main, YA
--        aplicados en producción vía mcp__supabase__apply_migration antes
--        de que Torneos V2 se deployara). Esa rama agregó
--        insert_reservation_hold_locked (camino con seña) y
--        create_direct_reservation (camino sin seña, club.requires_deposit
--        = false) — ver 20260920011254/011329/011345_*.sql — ambas ya
--        toman un advisory lock con la MISMA fórmula de clave que
--        lock_court_day (hashtextextended('court_day:'||court||':'||fecha,
--        0), inline porque lock_court_day no existía todavía en
--        producción) y ya revalidan contra matches/reservation_holds y
--        court_blocks (hora exacta — court_blocks.duration_minutes, que
--        habilita el chequeo por RANGO, es una columna que solo agrega
--        Torneos V2). Esta migración YA NO define create_reservation_hold
--        (una función especulativa de una ronda de hardening anterior a
--        confirmar lo de arriba): quedaba duplicando, con otro nombre y
--        otra lógica, algo que ya se resolvió y desplegó por otro camino.
--        Ver 20260924100000_reservation_hold_court_blocks_range.sql para
--        el único ajuste real pendiente (RANGO en vez de hora exacta, una
--        vez que exista court_blocks.duration_minutes).
--     C. consume_reservation_hold (migración 20260917120000): ya es una RPC
--        transaccional con FOR UPDATE sobre el hold. Reforzada acá con
--        lock_court_day + una revalidación nueva contra court_blocks
--        (torneo) — el INSERT en matches ya estaba protegido matches-vs-
--        matches por sin_partidos_superpuestos, pero no matches-vs-
--        court_blocks.
--     D. No existe otro camino de creación de reserva normal sin pasar por
--        un reservation_hold — auditado en app/(club)/[slug]/actions.ts y
--        app/(player)/reservas/actions.ts: ambos van por reservarCancha /
--        el mismo flujo de hold. app/admin/reservas/actions.ts (reserva
--        manual desde el panel del club) NO pasa por reservation_holds —
--        ver nota al final de este archivo (deuda documentada, no
--        modificada en esta ronda).
--     E. generate_fixed_slot_occurrence (migración 20260916150000): ya
--        tomaba SU PROPIO advisory lock (hashtextextended con OTRO prefijo
--        de clave) — reforzada acá para usar lock_court_day (misma clave
--        que A y C) y para revalidar también contra reservation_holds
--        (no lo hacía). Es el único writer real de ocurrencias de turno
--        fijo (deactivate_fixed_slot_atomic solo cancela, no ocupa canchas
--        nuevas).
--     F. Otros escritores de `matches`/`court_blocks` auditados: bloqueos
--        manuales (/admin/bloqueos) y entrenamientos (/admin/clases) NO
--        pasan por esta cadena de conflicto porque ellos MISMOS son una de
--        las fuentes que los demás ya consultan (court_blocks,
--        training_blocks) — no ocupan "por encima" de nada, son la
--        ocupación en sí. No requieren el lock: no hay una segunda
--        escritura concurrente sobre la MISMA fila que pueda pisarlos (son
--        inserts directos de un admin, no un flujo de checkout con
--        ventana de tiempo).
--
-- No se cambia ninguna regla de negocio, UX, redirect, monto ni columna de
-- Mercado Pago. reservarCancha sigue llamando a MP exactamente igual que
-- antes; solo el tramo de DB previo al pago se movió a esta RPC.

-- ---------------------------------------------------------------------------
-- E) turnos fijos: mismo lock que el resto + revalidar contra holds activos.
-- ---------------------------------------------------------------------------
create or replace function public.generate_fixed_slot_occurrence(
  p_fixed_slot_id uuid,
  p_date date,
  p_owner_id uuid,
  p_location_name text,
  p_total_price integer,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_slot public.fixed_slots%rowtype;
  v_now timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_start integer;
  v_end integer;
  v_match_id uuid;
begin
  select * into v_slot from public.fixed_slots where id = p_fixed_slot_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not v_slot.is_active then
    return jsonb_build_object('status', 'inactive');
  end if;
  if extract(dow from p_date)::integer <> v_slot.day_of_week then
    return jsonb_build_object('status', 'wrong_day');
  end if;
  if (p_date + v_slot.start_time) <= v_now then
    return jsonb_build_object('status', 'past');
  end if;

  -- Antes: pg_advisory_xact_lock(hashtextextended('fixed_slot_court_day:'||...))
  -- — una clave DISTINTA a la que usa tournament_assign_match_slot para el
  -- mismo concepto de "cancha+fecha", así que nunca se serializaban entre
  -- sí. Unificado en lock_court_day (migración 20260920100000).
  perform public.lock_court_day(v_slot.court_id, p_date);

  if exists (
    select 1 from public.fixed_slot_exceptions e
     where e.fixed_slot_id = p_fixed_slot_id and e.exception_date = p_date
  ) then
    return jsonb_build_object('status', 'exception');
  end if;

  if exists (
    select 1 from public.club_closed_days d
     where d.club_id = v_slot.club_id and d.closed_date = p_date
  ) then
    return jsonb_build_object('status', 'closed_day');
  end if;

  if exists (
    select 1 from public.matches m
     where m.fixed_slot_id = p_fixed_slot_id
       and m.scheduled_date = p_date
       and m.es_turno_fijo = true
       and coalesce(m.match_status, '') <> 'cancelled'
  ) then
    return jsonb_build_object('status', 'exists');
  end if;

  v_start := (extract(epoch from v_slot.start_time)::integer) / 60;
  v_end := v_start + coalesce(nullif(v_slot.duration_minutes, 0), 90);

  if exists (
    select 1 from public.matches m
     where m.court_id = v_slot.court_id
       and m.scheduled_date = p_date
       and m.scheduled_time is not null
       and coalesce(m.match_status, '') <> 'cancelled'
       and (extract(epoch from m.scheduled_time)::integer) / 60 < v_end
       and v_start < (extract(epoch from m.scheduled_time)::integer) / 60
                     + coalesce(nullif(m.duration_minutes, 0), 90)
  ) then
    return jsonb_build_object('status', 'occupied');
  end if;

  if exists (
    select 1 from public.court_blocks b
     where b.court_id = v_slot.court_id
       and (
         (b.blocked_date = p_date and b.blocked_time is not null
           and (extract(epoch from b.blocked_time)::integer) / 60 < v_end
           and v_start < (extract(epoch from b.blocked_time)::integer) / 60 + 90)
         or
         (b.date = p_date
           and (extract(epoch from b.start_time)::integer) / 60 < v_end
           and v_start < (extract(epoch from b.start_time)::integer) / 60 + 90)
       )
  ) then
    return jsonb_build_object('status', 'blocked');
  end if;

  -- NUEVO: un hold de pago vigente (checkout en curso de un jugador) también
  -- ocupa el horario, aunque todavía no exista ningún match.
  if exists (
    select 1 from public.reservation_holds h
     where h.court_id = v_slot.court_id
       and h.status = 'pending'
       and h.expires_at > now()
       and (extract(epoch from h.scheduled_time)::integer) / 60 < v_end
       and v_start < (extract(epoch from h.scheduled_time)::integer) / 60
                     + coalesce(nullif(h.duration_minutes, 0), 90)
       and h.scheduled_date = p_date
  ) then
    return jsonb_build_object('status', 'hold_conflict');
  end if;

  if p_dry_run then
    return jsonb_build_object('status', 'would_create');
  end if;

  if p_owner_id is null then
    return jsonb_build_object('status', 'no_owner');
  end if;

  begin
    insert into public.matches (
      match_type, match_status, payment_status, financial_status,
      total_price, amount_pending, scheduled_date, scheduled_time,
      duration_minutes, court_id, owner_id, location_name, date,
      es_turno_fijo, fixed_slot_id
    ) values (
      'reservation', 'scheduled', 'pending', 'unpaid',
      coalesce(p_total_price, 0), coalesce(p_total_price, 0), p_date, v_slot.start_time,
      coalesce(nullif(v_slot.duration_minutes, 0), 90), v_slot.court_id, p_owner_id, p_location_name,
      p_date + v_slot.start_time,
      true, p_fixed_slot_id
    )
    returning id into v_match_id;
  exception when unique_violation then
    return jsonb_build_object('status', 'exists');
  end;

  return jsonb_build_object('status', 'created', 'match_id', v_match_id);
end;
$$;

revoke execute on function public.generate_fixed_slot_occurrence(uuid, date, uuid, text, integer, boolean) from public;
revoke execute on function public.generate_fixed_slot_occurrence(uuid, date, uuid, text, integer, boolean) from anon;
revoke execute on function public.generate_fixed_slot_occurrence(uuid, date, uuid, text, integer, boolean) from authenticated;
grant execute on function public.generate_fixed_slot_occurrence(uuid, date, uuid, text, integer, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- C) consume_reservation_hold: mismo lock + revalidar contra court_blocks
-- (torneo/bloqueo manual) antes de crear el match. Si el conflicto aparece
-- acá, el pago YA se recibió: se devuelve un reason NUEVO ('court_conflict')
-- que el webhook (lib/mp-handlers/payment-webhook-handler.ts) ya trata de
-- forma genérica igual que 'hold_lost' — cualquier `!ok` termina en
-- orphaned_reservation_payments para revisión/reintegro manual, nunca se
-- pierde el dinero ni se revive el hold en silencio. No se tocó ese archivo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION consume_reservation_hold(
  p_hold_id uuid,
  p_mp_payment_id text,
  p_transaction_amount numeric
) RETURNS TABLE (
  ok boolean,
  reason text,
  match_id uuid
) AS $$
DECLARE
  v_hold reservation_holds%ROWTYPE;
  v_match_id uuid;
  v_amount_paid numeric;
  v_amount_pending numeric;
  v_financial_status text;
BEGIN
  SELECT * INTO v_hold FROM reservation_holds WHERE id = p_hold_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'hold_not_found'::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_hold.status = 'consumed' THEN
    RETURN QUERY SELECT true, 'already_consumed'::text, v_hold.consumed_match_id;
    RETURN;
  END IF;

  IF v_hold.status <> 'pending' OR v_hold.expires_at <= now() THEN
    RETURN QUERY SELECT false, 'hold_lost'::text, NULL::uuid;
    RETURN;
  END IF;

  -- Mismo lock que tournament_assign_match_slot / generate_fixed_slot_occurrence.
  PERFORM public.lock_court_day(v_hold.court_id, v_hold.scheduled_date);

  -- NUEVO: revalidar contra court_blocks (torneo o bloqueo manual) DESPUÉS
  -- del lock. El pago ya está aprobado — si esto dispara, es un caso
  -- excepcional (un torneo tomó la cancha mientras el jugador pagaba, sin
  -- que el hold lo hubiera bloqueado todavía en esta ronda de hardening) y
  -- el dinero queda registrado en orphaned_reservation_payments, no se
  -- inventa una reserva sobre una cancha que ya no está libre.
  IF EXISTS (
    SELECT 1 FROM court_blocks cb
    WHERE cb.court_id = v_hold.court_id
      AND cb.blocked_date = v_hold.scheduled_date
      AND (extract(epoch FROM v_hold.scheduled_time)::integer) / 60
          < (extract(epoch FROM cb.blocked_time)::integer) / 60 + coalesce(nullif(cb.duration_minutes, 0), 90)
      AND (extract(epoch FROM cb.blocked_time)::integer) / 60
          < (extract(epoch FROM v_hold.scheduled_time)::integer) / 60 + coalesce(nullif(v_hold.duration_minutes, 0), 90)
  ) THEN
    RETURN QUERY SELECT false, 'court_conflict'::text, NULL::uuid;
    RETURN;
  END IF;

  v_amount_paid := LEAST(v_hold.deposit_amount, v_hold.total_price);
  v_amount_pending := GREATEST(v_hold.total_price - v_amount_paid, 0);
  v_financial_status := CASE
    WHEN v_amount_paid >= v_hold.total_price AND v_hold.total_price > 0 THEN 'fully_paid'
    WHEN v_amount_paid > 0 THEN 'partially_paid'
    ELSE 'unpaid'
  END;

  INSERT INTO matches (
    court_id, owner_id, scheduled_date, scheduled_time, duration_minutes,
    total_price, payment_status, amount_paid, amount_pending, financial_status,
    match_status, match_type, location_name, date, confirmed_at
  ) VALUES (
    v_hold.court_id, v_hold.owner_id, v_hold.scheduled_date, v_hold.scheduled_time, v_hold.duration_minutes,
    v_hold.total_price, 'paid', v_amount_paid, v_amount_pending, v_financial_status,
    'reserved', 'reservation', v_hold.location_name, v_hold.starts_at, now()
  )
  RETURNING id INTO v_match_id;

  INSERT INTO match_participants (match_id, player_id, team)
  VALUES (v_match_id, v_hold.owner_id, 1);

  INSERT INTO payments (match_id, user_id, mp_preference_id, mp_payment_id, status, amount, payment_method)
  VALUES (v_match_id, v_hold.owner_id, v_hold.mp_preference_id, p_mp_payment_id, 'approved', p_transaction_amount, 'mercadopago');

  UPDATE reservation_holds
  SET status = 'consumed', consumed_match_id = v_match_id, updated_at = now()
  WHERE id = p_hold_id;

  RETURN QUERY SELECT true, 'created'::text, v_match_id;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION consume_reservation_hold(uuid, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_reservation_hold(uuid, text, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_reservation_hold(uuid, text, numeric) TO service_role;

-- ---------------------------------------------------------------------------
-- D) Reserva manual del club (/admin/reservas): resuelta en
-- 20260923100000_admin_manual_reservation_lock.sql
-- (admin_create_manual_reservation), no en este archivo.
-- ---------------------------------------------------------------------------
