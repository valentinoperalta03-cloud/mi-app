-- reservation_holds: retención temporal de cancha durante el checkout de
-- Mercado Pago, separada de `matches`.
--
-- CAMBIO DE REGLA DE PRODUCTO: una fila `matches` de match_type='reservation'
-- representa SIEMPRE una reserva ya confirmada (seña pagada,
-- match_status='reserved', payment_status='paid'). Antes de pagar NO existe
-- ningún estado intermedio visible/semántico dentro de matches — ni
-- 'scheduled', ni 'pending', ni hold_expires_at. Ese hold pre-pago ahora
-- vive en esta tabla nueva, completamente separada.
--
-- FORWARD-ONLY: esta migración NO modifica ni reaplica
-- 20260917110000_matches_reservation_hold.sql (ya aplicada en producción,
-- código ya desplegado). matches.hold_expires_at y el índice
-- one_pending_reservation_hold_per_owner sobre matches quedan intactos por
-- compatibilidad con filas legacy que puedan seguir en vuelo al momento del
-- deploy (checkouts iniciados con el código anterior) — el código nuevo deja
-- de escribir esos campos para reservas nuevas, pero el webhook mantiene un
-- fallback que sigue sabiendo procesarlas (ver payment-webhook-handler.ts).
-- No se borra ni se dropea nada de lo ya aplicado.
--
-- NO se aplicó en ningún ambiente remoto. Solo existe como archivo local.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS reservation_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id),
  club_id uuid NOT NULL REFERENCES clubs(id),
  court_id uuid NOT NULL REFERENCES courts(id),
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 90,
  starts_at timestamptz NOT NULL,
  -- Calculado en la aplicación al insertar (starts_at + duration_minutes),
  -- NUNCA en una expresión de índice/constraint: Postgres exige que las
  -- expresiones dentro de un índice sean IMMUTABLE, y "starts_at + N *
  -- interval" no lo es de forma confiable entre sesiones/configuración —
  -- de ahí el error 42P17 de la versión anterior de esta migración. Con
  -- ends_at como columna normal, el EXCLUDE de más abajo solo referencia
  -- columnas (siempre válido), sin aritmética ni casts adentro.
  ends_at timestamptz NOT NULL,
  total_price integer NOT NULL,
  deposit_amount integer NOT NULL,
  location_name text,
  mp_preference_id text,
  external_reference text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'consumed', 'cancelled', 'expired')),
  expires_at timestamptz NOT NULL,
  consumed_match_id uuid REFERENCES matches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE reservation_holds IS
  'Retención temporal de cancha mientras el jugador paga la seña por Mercado Pago. NO es una reserva: una fila matches de match_type=reservation solo existe una vez que el hold se convierte (pago aprobado, ver consume_reservation_hold()). Si el hold vence o el pago no llega, nunca se crea ningún match.';

CREATE INDEX IF NOT EXISTS reservation_holds_owner_idx ON reservation_holds (owner_id);
CREATE INDEX IF NOT EXISTS reservation_holds_court_date_idx ON reservation_holds (court_id, scheduled_date);
CREATE INDEX IF NOT EXISTS reservation_holds_expires_at_idx
  ON reservation_holds (expires_at)
  WHERE status = 'pending';

-- Un solo hold pendiente por usuario, atómico a nivel DB — mismo mecanismo
-- que ya protegía one_pending_reservation_hold_per_owner sobre matches, acá
-- aplicado a la entidad correcta.
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_hold_per_owner
  ON reservation_holds (owner_id)
  WHERE status = 'pending';

-- Dos holds pendientes no pueden solaparse en la misma cancha/horario —
-- mismo mecanismo que sin_partidos_superpuestos sobre matches, acá aplicado
-- antes de que exista ninguna reserva real. tstzrange(starts_at, ends_at)
-- referencia solo columnas (ambas ya calculadas por la aplicación al
-- insertar) — sin aritmética ni casts adentro de la expresión del índice.
ALTER TABLE reservation_holds ADD CONSTRAINT reservation_holds_no_overlap
  EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status = 'pending');

ALTER TABLE reservation_holds ENABLE ROW LEVEL SECURITY;

-- Lectura del propio hold habilitada por higiene (hoy nada del cliente lo
-- necesita: todas las escrituras van por service role desde server actions
-- que validan ownership en código, mismo patrón que assertCourtOwnership en
-- app/admin/reservas/actions.ts). Sin políticas de INSERT/UPDATE/DELETE para
-- authenticated: sin ellas, RLS bloquea esas operaciones por defecto — que
-- es exactamente lo que se quiere, todas las escrituras son server-side.
CREATE POLICY reservation_holds_select_own ON reservation_holds
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- Conversión atómica hold -> reserva confirmada. Se llama SOLO desde el
-- webhook de Mercado Pago (service role) cuando el pago llega 'approved'.
-- Todo corre en UNA transacción (una función = una transacción implícita):
-- si el INSERT en matches choca con sin_partidos_superpuestos (defensa en
-- profundidad — no debería poder pasar, el hold ya reservaba el horario),
-- la función entera revierte y el hold NO queda 'consumed' a medias.
--
-- SELECT ... FOR UPDATE bloquea la fila del hold: si dos webhooks/retries
-- llegan en simultáneo para el mismo hold, el segundo espera acá y, al
-- obtener el lock, ve status='consumed' (lo que dejó el primero) y sale
-- limpio por la rama 'already_consumed' — nunca crea un segundo match.
-- ─────────────────────────────────────────────────────────────────────────
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

-- Solo el webhook (service role) puede convertir un hold en reserva. Sin
-- este REVOKE, cualquier usuario autenticado podría invocar la función vía
-- PostgREST RPC con el id de un hold ajeno y un mp_payment_id inventado, y
-- confirmarse una reserva sin haber pagado nada — la función en sí no valida
-- ownership ni verifica el pago contra MP, confía en que solo el webhook la
-- llama después de haber verificado la firma HMAC y consultado la API real
-- de Mercado Pago.
REVOKE ALL ON FUNCTION consume_reservation_hold(uuid, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_reservation_hold(uuid, text, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_reservation_hold(uuid, text, numeric) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- Dinero cobrado por Mercado Pago nunca puede existir SOLO en logs. Cuando
-- un pago llega 'approved' después de que su hold ya se perdió (venció o
-- fue cancelado — la cancha puede estar ocupada por otro usuario a esta
-- altura), no se crea ninguna reserva. Tampoco se reutiliza `payments`:
-- `payments.match_id` es NOT NULL, no hay match al que atarlo, y forzar uno
-- sería semánticamente incorrecto (implicaría que existe una reserva). Este
-- pago recibido queda acá, auditable, para conciliación/reembolso manual.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orphaned_reservation_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_payment_id text NOT NULL,
  hold_id uuid REFERENCES reservation_holds(id),
  owner_id uuid REFERENCES profiles(id),
  amount numeric NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('approved', 'refunded', 'reconciled')),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  -- Idempotencia real: un webhook duplicado para el mismo pago de MP no
  -- inserta una segunda fila — la unicidad la da la propia DB, no un
  -- chequeo de aplicación que se puede saltear con una carrera.
  UNIQUE (mp_payment_id)
);

COMMENT ON TABLE orphaned_reservation_payments IS
  'Pagos de MP aprobados que llegaron después de que su reservation_hold ya se había perdido (vencido/cancelado). El dinero se recibió pero no hay ninguna reserva a la que atarlo con seguridad — queda acá para revisión/reintegro manual. UNIQUE(mp_payment_id) da idempotencia ante retries del webhook.';

ALTER TABLE orphaned_reservation_payments ENABLE ROW LEVEL SECURITY;
-- Sin políticas para authenticated/anon: RLS bloquea todo acceso de cliente
-- por defecto. Toda lectura/escritura va por service role (webhook +
-- futura pantalla de conciliación en superadmin) — dinero real, no se
-- expone al cliente bajo ninguna circunstancia.
