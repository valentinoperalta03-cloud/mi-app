-- FIX CRÍTICO: one_pending_reservation_hold_per_owner (creado en
-- 20260917110000_matches_reservation_hold.sql, YA APLICADA) usaba
-- match_type='reservation' AND match_status='scheduled' AND
-- payment_status='pending' como proxy de "hold de pago de MP en curso"
-- dentro de `matches`. Ese proxy es ambiguo: generate_fixed_slot_occurrence()
-- (20260916150000_fixed_slot_atomic_generation_and_deactivation.sql) inserta
-- CADA ocurrencia de turno fijo con exactamente esos mismos tres valores —
-- los turnos fijos no se pagan por MP, quedan 'scheduled'/'pending' hasta
-- que el club cobra offline. Un mismo owner_id (jugador con varios turnos
-- fijos, o el dueño del club usado como fallback cuando el turno todavía no
-- tiene jugador asignado) tiene LEGÍTIMAMENTE muchas filas así en
-- simultáneo — nunca fue un hold de pago.
--
-- Daño ya confirmado en producción (verificado SOLO CON SELECT desde este
-- proceso, sin escribir nada):
--   - La limpieza legacy de esa misma migración canceló 920 ocurrencias de
--     turno fijo (payment_status → 'expired'), 362 de ellas futuras
--     (2026-06-15 a 2026-09-30), porque el criterio de limpieza no excluía
--     es_turno_fijo/fixed_slot_id.
--   - Aunque esa limpieza no hubiera corrido, el índice por sí solo iba a
--     bloquear la generación diaria de turnos fijos (cron
--     generate-fixed-slot-reservations) apenas un mismo owner_id tuviera
--     2+ turnos fijos activos: hoy hay owners con 91 y 85 turnos fijos
--     activos compartiendo owner_id (jugador o fallback al dueño del club).
--
-- TRANSICIÓN SEGURA — producción todavía tiene desplegado el sistema legacy
-- (reservarCancha crea el hold como una fila `matches` directamente), así
-- que la protección "1 hold pendiente por owner" TODAVÍA hace falta para
-- reservas de cancha normales por MP. No se dropea sin reemplazo: se
-- recrea el mismo índice, agregando `fixed_slot_id IS NULL` a las
-- condiciones existentes, para que dejen de matchear turnos fijos y sigan
-- protegiendo el flujo legacy de MP mientras conviva con él. Cuando se
-- despliegue reservation_holds (20260917120000_reservation_holds.sql), el
-- flujo legacy deja de crear filas `matches` de este tipo y este índice
-- queda simplemente sin uso (no hace falta dropearlo en ese momento).
--
-- FORWARD-ONLY: no se edita ni se reaplica 20260917110000. No se hace
-- rollback de la limpieza ya ejecutada — las 920 filas quedan tal cual
-- (canceladas), y se recuperan regenerando SOLO las ocurrencias futuras
-- válidas vía generate_fixed_slot_occurrence/reconcile (ver
-- scripts/reconcile-fixed-slots.ts), nunca con un UPDATE masivo
-- cancelled → scheduled: la RPC vuelve a validar día cerrado, ocupación de
-- cancha, bloqueos y excepciones antes de crear cada ocurrencia, un UPDATE
-- directo no. No se toca expire-unpaid-matches (ya excluía es_turno_fijo,
-- nunca tuvo este bug) ni sin_partidos_superpuestos (sigue protegiendo
-- correctamente el solapamiento de cancha/horario para turnos fijos).
--
-- Verificado antes de recrear el índice (SOLO SELECT, sin escribir nada):
-- 0 owners tienen hoy más de un hold legacy de MP (fixed_slot_id IS NULL)
-- pendiente simultáneo, así que el CREATE UNIQUE INDEX no falla.
--
-- NO se aplicó en ningún ambiente remoto. Solo existe como archivo local.

DROP INDEX IF EXISTS one_pending_reservation_hold_per_owner;

CREATE UNIQUE INDEX IF NOT EXISTS one_pending_reservation_hold_per_owner
  ON matches (owner_id)
  WHERE match_type = 'reservation'
    AND match_status = 'scheduled'
    AND payment_status = 'pending'
    AND fixed_slot_id IS NULL;

-- Chequeo de la propia migración: confirmar que el índice quedó recreado
-- (no solo dropeado).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'one_pending_reservation_hold_per_owner' AND tablename = 'matches'
  ) THEN
    RAISE EXCEPTION 'matches_reservation_hold_fix: one_pending_reservation_hold_per_owner debería existir (recreado sin turnos fijos) y no existe';
  END IF;
  RAISE NOTICE 'matches_reservation_hold_fix: one_pending_reservation_hold_per_owner recreado con fixed_slot_id IS NULL — protege holds legacy de MP, turnos fijos quedan afuera';
END $$;

-- Chequeo adicional: ningún turno fijo puede satisfacer la condición del
-- índice recreado (fixed_slot_id IS NULL lo excluye por construcción, esto
-- lo deja explícito en el log de la migración).
DO $$
DECLARE v_fixed_slots_in_index bigint;
BEGIN
  SELECT count(*) INTO v_fixed_slots_in_index
  FROM matches
  WHERE match_type = 'reservation'
    AND match_status = 'scheduled'
    AND payment_status = 'pending'
    AND fixed_slot_id IS NULL
    AND es_turno_fijo = true;
  IF v_fixed_slots_in_index > 0 THEN
    RAISE EXCEPTION 'matches_reservation_hold_fix: % turnos fijos con fixed_slot_id NULL pero es_turno_fijo=true — desfase entre columnas, revisar antes de confiar en este índice', v_fixed_slots_in_index;
  END IF;
END $$;

-- Nota para quien reaplique este patrón a futuro: cualquier índice o
-- lógica de "un hold por owner" sobre `matches` debe excluir explícitamente
-- fixed_slot_id IS NOT NULL / es_turno_fijo = true, o mejor — no existir en
-- absoluto. Bajo la arquitectura vigente (una vez desplegada) los holds de
-- pago viven en reservation_holds, nunca en matches.

-- ─────────────────────────────────────────────────────────────────────────
-- Guardia estructural (no solo documentación): un turno fijo NUNCA puede
-- tener hold_expires_at seteado. Hoy nada lo setea (generate_fixed_slot_occurrence
-- no toca esa columna, y lib/reservation-hold.ts ya no toca `matches` en
-- absoluto), pero un CHECK constraint lo hace imposible aunque alguien
-- reintroduzca ese error a futuro — no depende de que el código nuevo se
-- acuerde de excluir fixed slots correctamente cada vez.
-- Verificado antes de agregarlo (SOLO SELECT): 0 filas lo violarían hoy.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE matches ADD CONSTRAINT fixed_slots_never_have_hold_expiry
  CHECK (NOT (es_turno_fijo = true AND hold_expires_at IS NOT NULL));
