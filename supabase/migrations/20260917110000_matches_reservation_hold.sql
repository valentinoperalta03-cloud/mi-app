-- Hold de pago explícito para reservas de cancha (match_type = 'reservation').
--
-- Antes, una reserva quedaba en match_status='scheduled', payment_status='pending'
-- desde el INSERT hasta que el webhook de MP la confirmaba, y solo se liberaba
-- si un cron (corriendo una vez al día) la detectaba vieja. Esta migración le da
-- al hold una fuente de verdad explícita (hold_expires_at) y evita que un mismo
-- usuario tenga dos holds de pago pendientes en simultáneo, de forma atómica.
--
-- ORDEN CRÍTICO (ver bloqueo de pre-deploy): en producción hay cientos de
-- matches legacy en match_type='reservation', match_status='scheduled',
-- payment_status='pending', algunos owner_id con más de una fila. Si el
-- UNIQUE INDEX parcial se crea ANTES de limpiar esas filas, CREATE UNIQUE
-- INDEX falla inmediatamente por duplicados. Por eso este archivo:
--   1) agrega la columna hold_expires_at;
--   2) identifica candidatos a limpiar con criterio estricto (ver abajo) y
--      aborta con RAISE EXCEPTION si algún candidato tiene plata o pago
--      aprobado real — nunca cancela algo con dinero de por medio;
--   3) cancela/expira SOLO esos candidatos;
--   4) a los que SOBREVIVEN (legacy "recientes" — holds legítimamente en
--      checkout al momento de correr la migración) les rellena
--      hold_expires_at = created_at + 10 minutos: nunca deben quedar como
--      scheduled + pending + hold_expires_at NULL, porque para la app eso
--      es indistinguible de un checkout real en curso (ver isHoldExpired en
--      lib/reservation-hold.ts, que trata NULL + created_at reciente como
--      "no vencido");
--   5) chequeo A: 0 filas scheduled/pending con hold_expires_at NULL;
--   6) chequeo B: 0 owners con >1 hold pendiente activo (si no, aborta ANTES
--      de intentar el índice, con un mensaje claro en vez del error crudo
--      de Postgres — puede pasar si dos holds legítimos de un mismo usuario
--      sobreviven ambos por ser recientes; requiere revisión manual, la
--      migración no decide cuál de los dos cancelar);
--   7) recién ahí crea one_pending_reservation_hold_per_owner;
--   8) chequeo C: ninguna fila con plata quedó marcada 'expired' por la
--      limpieza; chequeo D: el índice existe.
--
-- Migración autocontenida: se puede aplicar directamente sobre el estado
-- real de producción, sin correr ningún script separado antes, sin importar
-- cuántos holds legacy "recientes" (en checkout activo) existan en ese momento.
--
-- NO se aplicó en ningún ambiente remoto. Solo existe como archivo local.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz;

COMMENT ON COLUMN matches.hold_expires_at IS
  'Vencimiento del hold de pago (match_status=scheduled, payment_status=pending, match_type=reservation). NULL para matches que no son un hold de pago (partidos abiertos, turnos fijos, ya confirmados/cancelados, etc).';

CREATE INDEX IF NOT EXISTS matches_hold_expires_at_idx
  ON matches (hold_expires_at)
  WHERE match_status = 'scheduled' AND payment_status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────
-- Paso 2: diagnóstico previo (solo informativo, no modifica nada).
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_dup_owners_before int;
  v_total_pending_before bigint;
BEGIN
  SELECT count(*) INTO v_dup_owners_before FROM (
    SELECT owner_id
    FROM matches
    WHERE match_type = 'reservation'
      AND match_status = 'scheduled'
      AND payment_status = 'pending'
    GROUP BY owner_id
    HAVING count(*) > 1
  ) d;

  SELECT count(*) INTO v_total_pending_before
  FROM matches
  WHERE match_type = 'reservation'
    AND match_status = 'scheduled'
    AND payment_status = 'pending';

  RAISE NOTICE 'matches_reservation_hold: % filas scheduled/pending antes de limpiar, % owners con más de una', v_total_pending_before, v_dup_owners_before;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Paso 2b: candidatos a limpiar — criterio estricto, TODOS obligatorios:
--   - match_type = 'reservation' (nunca toca amistoso/turno fijo/competitivo)
--   - match_status = 'scheduled' AND payment_status = 'pending' (el estado
--     exacto de un hold de pago sin confirmar; 'paid'/'cash_pending'/
--     'transfer_pending'/'refund_requested' quedan afuera por definición)
--   - amount_paid = 0 (0 pesos cobrados en el match)
--   - sin ninguna fila en `payments` con status 'approved' o
--     'refund_requested' para ese match_id (0 pagos reales asociados,
--     aprobados o en camino de reembolso)
--   - created_at con más de 10 minutos (mismo HOLD_MINUTES que usa la app
--     — lib/reservation-hold.ts — así una fila legacy realmente "en
--     checkout ahora mismo" jamás entra a la limpieza)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE _hold_cleanup_candidates ON COMMIT DROP AS
SELECT m.id
FROM matches m
WHERE m.match_type = 'reservation'
  AND m.match_status = 'scheduled'
  AND m.payment_status = 'pending'
  AND coalesce(m.amount_paid, 0) = 0
  AND m.created_at < now() - interval '10 minutes'
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.match_id = m.id
      AND p.status IN ('approved', 'refund_requested')
  );

-- Chequeo previo (no es A/B/C/D — esos son los 4 pedidos en la revisión
-- final, ver más abajo): ningún candidato tiene plata o pago aprobado real.
-- Si esto dispara, hay un bug en el criterio de arriba — abortar la
-- migración entera en vez de arriesgar cancelar algo con dinero de por medio.
DO $$
DECLARE v_bad_count bigint;
BEGIN
  SELECT count(*) INTO v_bad_count
  FROM _hold_cleanup_candidates c
  JOIN matches m ON m.id = c.id
  WHERE coalesce(m.amount_paid, 0) > 0
     OR EXISTS (
       SELECT 1 FROM payments p
       WHERE p.match_id = m.id AND p.status IN ('approved', 'refund_requested')
     );
  IF v_bad_count > 0 THEN
    RAISE EXCEPTION 'matches_reservation_hold: % candidatos a limpiar tienen plata o pago aprobado asociado — abortando migración sin tocar nada', v_bad_count;
  END IF;
END $$;

-- Paso 3: cancelar/expirar SOLO los candidatos verificados.
UPDATE matches m
SET match_status = 'cancelled', payment_status = 'expired'
FROM _hold_cleanup_candidates c
WHERE m.id = c.id;

UPDATE payments p
SET status = 'expired', updated_at = now()
FROM _hold_cleanup_candidates c
WHERE p.match_id = c.id
  AND p.status = 'pending';

DO $$
DECLARE v_cleaned bigint;
BEGIN
  SELECT count(*) INTO v_cleaned FROM _hold_cleanup_candidates;
  RAISE NOTICE 'matches_reservation_hold: % holds legacy impagos cancelados/expirados', v_cleaned;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Paso 4: backfill de hold_expires_at para los SOBREVIVIENTES — holds
-- legacy que NO entraron a la limpieza porque son "recientes" (created_at
-- dentro de los últimos 10 minutos al momento de correr esta migración: un
-- checkout legítimamente en curso). Sin este paso quedarían como
-- scheduled + pending + hold_expires_at NULL, que para isHoldExpired()
-- (lib/reservation-hold.ts) es indistinguible de "todavía no vencido", pero
-- sin una fecha de vencimiento explícita — justo lo que esta migración
-- busca eliminar. Se deriva del created_at real de cada fila, no del
-- momento en que corre la migración, para no regalarles ni quitarles
-- tiempo de checkout real.
-- ─────────────────────────────────────────────────────────────────────────
UPDATE matches
SET hold_expires_at = created_at + interval '10 minutes'
WHERE match_type = 'reservation'
  AND match_status = 'scheduled'
  AND payment_status = 'pending'
  AND hold_expires_at IS NULL;

-- Chequeo A: 0 filas scheduled/pending con hold_expires_at NULL después del
-- backfill. Si esto dispara, algo quedó fuera de los dos pasos de arriba
-- (limpieza + backfill) — abortar antes de crear el índice.
DO $$
DECLARE v_null_hold_expiry bigint;
BEGIN
  SELECT count(*) INTO v_null_hold_expiry
  FROM matches
  WHERE match_type = 'reservation'
    AND match_status = 'scheduled'
    AND payment_status = 'pending'
    AND hold_expires_at IS NULL;
  IF v_null_hold_expiry > 0 THEN
    RAISE EXCEPTION 'matches_reservation_hold: quedan % filas scheduled/pending con hold_expires_at NULL después de limpiar y backfillear — abortando', v_null_hold_expiry;
  END IF;
  RAISE NOTICE 'matches_reservation_hold: 0 filas scheduled/pending con hold_expires_at NULL — invariante OK (chequeo A)';
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Chequeo B: 0 owners con más de un hold pendiente activo ANTES de intentar
-- crear el índice único — si esto dispara, quedan holds "recientes"
-- legítimos duplicados del mismo usuario (ej. dos checkouts simultáneos al
-- momento de correr la migración) y hace falta revisión manual en vez de
-- dejar que CREATE UNIQUE INDEX falle con un error crudo de Postgres. La
-- migración NO decide unilateralmente cuál de los dos cancelar.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_dup_owners_after int;
BEGIN
  SELECT count(*) INTO v_dup_owners_after FROM (
    SELECT owner_id
    FROM matches
    WHERE match_type = 'reservation'
      AND match_status = 'scheduled'
      AND payment_status = 'pending'
    GROUP BY owner_id
    HAVING count(*) > 1
  ) d;
  IF v_dup_owners_after > 0 THEN
    RAISE EXCEPTION 'matches_reservation_hold: quedan % owners con más de un hold pendiente activo después de la limpieza legacy — CREATE UNIQUE INDEX fallaría. Revisar manualmente (probable: holds legítimos en checkout simultáneo) antes de reintentar esta migración.', v_dup_owners_after;
  END IF;
  RAISE NOTICE 'matches_reservation_hold: 0 owners con holds pendientes duplicados antes de crear el índice — invariante OK (chequeo B)';
END $$;

-- Un solo hold de pago pendiente por usuario para reservas de cancha. Dos
-- INSERT concurrentes para el mismo owner_id chocan acá aunque ambos hayan
-- pasado la validación en la app (mismo mecanismo de defensa que ya usa
-- sin_partidos_superpuestos para el solapamiento de cancha/horario).
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_reservation_hold_per_owner
  ON matches (owner_id)
  WHERE match_type = 'reservation'
    AND match_status = 'scheduled'
    AND payment_status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────
-- Paso 6: verificaciones finales (post-índice).
-- ─────────────────────────────────────────────────────────────────────────

-- Chequeo C: ninguna reserva con plata quedó 'expired' por la limpieza
-- (invariante general: payment_status='expired' implica 0 pesos cobrados y
-- 0 pagos aprobados/en reembolso asociados). Recálculo post-índice para
-- dejar constancia en el log de que nada de esto se movió entre el paso 3
-- y este punto.
DO $$
DECLARE v_money_marked_expired bigint;
BEGIN
  SELECT count(*) INTO v_money_marked_expired
  FROM matches m
  WHERE m.match_type = 'reservation'
    AND m.payment_status = 'expired'
    AND (
      coalesce(m.amount_paid, 0) > 0
      OR EXISTS (
        SELECT 1 FROM payments p
        WHERE p.match_id = m.id AND p.status IN ('approved', 'refund_requested')
      )
    );
  IF v_money_marked_expired > 0 THEN
    RAISE EXCEPTION 'matches_reservation_hold: % reservas con plata o pago aprobado quedaron marcadas expired — esto no debería poder pasar, abortando', v_money_marked_expired;
  END IF;
  RAISE NOTICE 'matches_reservation_hold: reservas pagadas/con pago aprobado intactas — invariante OK (chequeo C)';
END $$;

-- Chequeo D: el índice único existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'one_pending_reservation_hold_per_owner' AND tablename = 'matches'
  ) THEN
    RAISE EXCEPTION 'matches_reservation_hold: one_pending_reservation_hold_per_owner no se creó';
  END IF;
  RAISE NOTICE 'matches_reservation_hold: índice one_pending_reservation_hold_per_owner creado — invariante OK (chequeo D)';
END $$;

-- Recálculo final de 0 duplicados por owner, ahora que el índice ya existe
-- (debe dar 0 necesariamente si el CREATE UNIQUE INDEX de arriba tuvo
-- éxito — se valida explícito para dejar constancia en el log).
DO $$
DECLARE v_dup_owners_final int;
BEGIN
  SELECT count(*) INTO v_dup_owners_final FROM (
    SELECT owner_id
    FROM matches
    WHERE match_type = 'reservation'
      AND match_status = 'scheduled'
      AND payment_status = 'pending'
    GROUP BY owner_id
    HAVING count(*) > 1
  ) d;
  IF v_dup_owners_final > 0 THEN
    RAISE EXCEPTION 'matches_reservation_hold: % owners con holds duplicados después de crear el índice — no debería ser posible', v_dup_owners_final;
  END IF;
  RAISE NOTICE 'matches_reservation_hold: 0 owners con holds pendientes duplicados post-índice — invariante OK';
END $$;
