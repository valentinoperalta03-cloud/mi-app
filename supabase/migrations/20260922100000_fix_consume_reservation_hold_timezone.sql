-- Fix timezone: consume_reservation_hold escribía matches.date con
-- v_hold.starts_at (timestamptz). matches.date es `timestamp without time
-- zone` — el cast implícito timestamptz -> timestamp lo convierte a la
-- timezone de la sesión (UTC), desplazando una reserva de las 16:30
-- Argentina a las 19:30 en matches.date. scheduled_date/scheduled_time (las
-- columnas que sí se muestran al usuario) nunca estuvieron mal: solo `date`
-- (columna legacy, usada por vistas/ordenamiento) quedaba corrida.
--
-- Fix: usar v_hold.scheduled_date + v_hold.scheduled_time (date + time ->
-- timestamp sin conversión de timezone), consistente con
-- generate_fixed_slot_occurrence que ya arma `date` de la misma forma
-- (p_date + v_slot.start_time, ver 20260921100000_occupancy_lock_hardening.sql).
--
-- Aplicado manualmente en producción el 2026-09-18 durante el incidente del
-- hold 6b3b672c-783d-4907-aae7-5f148c1c93b3; esta migración solo trackea ese
-- mismo cambio en el repo (forward-only, no reaplica ni modifica
-- 20260917120000_reservation_holds.sql ni 20260921100000_occupancy_lock_hardening.sql).
--
-- Sin cambios de policy de holds acá — eso se resolvió en código de
-- aplicación (ver lib/reservation-hold.ts shouldReleaseHoldOnPaymentNotification
-- y lib/mp-handlers/payment-webhook-handler.ts), no en esta función.

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

  PERFORM public.lock_court_day(v_hold.court_id, v_hold.scheduled_date);

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
    'reserved', 'reservation', v_hold.location_name,
    -- FIX: antes v_hold.starts_at (timestamptz -> timestamp corría a UTC).
    v_hold.scheduled_date + v_hold.scheduled_time,
    now()
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
