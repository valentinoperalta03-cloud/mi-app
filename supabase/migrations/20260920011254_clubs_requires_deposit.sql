-- Reservas sin seña por configuración del club (camino B — independiente de
-- Torneos V2, ver docs/designs si aplica). No depende de lock_court_day,
-- clock_to_minutes, create_reservation_hold ni court_blocks.duration_minutes
-- — ninguno de esos existe en producción a la fecha de esta migración
-- (verificado por lectura directa contra pg_proc/information_schema, no
-- asumido desde el repo local).
--
-- requires_deposit distingue "el club exige seña online para confirmar
-- reservas" (comportamiento actual, TRUE por defecto) de "el club confirma
-- reservas sin cobro online" (FALSE). Default TRUE: ningún club existente
-- cambia de comportamiento con este deploy.
--
-- deposit_type/deposit_value NO se tocan ni se resetean acá: un club que
-- desactiva la seña conserva su tipo/monto configurado por si vuelve a
-- activarla (ver app/admin/canchas/actions.ts::updateClubDeposit).
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS requires_deposit boolean NOT NULL DEFAULT true;

-- Mismo patrón que deposit_type/deposit_value (verificado en producción:
-- 20260716192606_fix_clubs_deposit_column_grants): PostgREST rechaza el
-- SELECT completo de la fila si falta el grant de una sola columna
-- consultada. reservar/page.tsx, reservarCancha y el onboarding leen esta
-- columna con el cliente de sesión (no service role).
grant select (requires_deposit) on public.clubs to anon, authenticated;
