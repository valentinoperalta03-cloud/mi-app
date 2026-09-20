-- ═══════════════════════════════════════════════════════════════════════
-- HOTFIX DE SEGURIDAD — exposición de clubs.mp_access_token y otras
-- credenciales/datos de facturación a anon/authenticated.
--
-- INDEPENDIENTE de reservas sin seña y de Torneos V2. No depende de ninguna
-- migración pendiente. Diseñada para aplicarse SOLA, de inmediato, sin
-- esperar al resto de la cola — vía mcp__supabase__apply_migration o el SQL
-- Editor de Supabase directamente, sin pasar por `supabase db push` (el
-- historial de migraciones de este proyecto tiene un quiebre conocido en
-- 20260412120000_posts_messages.sql que rompe el replay completo — ver
-- informe de la sesión de reservas sin seña). Esta migración no lo toca.
--
-- CAUSA RAÍZ (verificada por lectura directa contra producción, sin
-- escribir nada):
--   1. pg_class.relacl de public.clubs: {..., anon=r/postgres,
--      authenticated=r/postgres} — GRANT SELECT A NIVEL DE TABLA completa,
--      no una fuga columna por columna. Los GRANT SELECT (columna) que ya
--      existían en el historial (deposit_type, deposit_value,
--      cancellation_hours, slug, services, facebook, tiktok) eran no-ops
--      redundantes: el grant de tabla ya cubría todo.
--
--      IMPORTANTE: esta migración es INDEPENDIENTE de reservas sin seña.
--      clubs.requires_deposit NO EXISTE TODAVÍA en producción (verificado
--      recién contra information_schema.columns) — esa columna, y su propio
--      GRANT SELECT puntual, los otorga exclusivamente la migración de
--      reservas sin seña (20260923100000_clubs_requires_deposit.sql) el día
--      que se despliegue. Esta migración NO la menciona ni depende de ella.
--   2. RLS de clubs ("clubs_public_read" / "Clubes visibles para todos"):
--      USING (true) — CUALQUIER fila es visible para cualquiera. La
--      combinación (1)+(2) expone TODAS las columnas de TODOS los clubes,
--      incluido mp_access_token, a cualquiera con la clave anon pública.
--   3. La vista public.superadmin_clubs_overview expone c.mp_access_token
--      en crudo como columna propia, y tiene GRANT SELECT (y de hecho ALL)
--      otorgado directamente a anon Y authenticated — sin ningún filtro
--      "WHERE is_superadmin()" en su definición (a diferencia de
--      superadmin_profiles_overview, que sí lo tiene y por eso NO se toca
--      acá). Verificado: el código real (app/superadmin/**) SIEMPRE la
--      consulta con el service client (`svc = createServiceClient()`) —
--      revocar acá no rompe ningún uso legítimo.
--
-- AUDITORÍA DE USO REAL (grep exhaustivo sobre el repo desplegado, no
-- suposición) para construir la whitelist de columnas públicas:
--   - owner_id: usado en filtros .eq("owner_id", ...) vía el cliente de
--     SESIÓN (no service) en lib/auth-redirect.ts, proxy.ts (middleware de
--     todo /admin/*), lib/admin/owner-context.ts (getOwnerAdminContext,
--     base de TODO el panel admin) y ~10 acciones más de app/admin/**.
--     Postgres exige SELECT sobre una columna para poder filtrar por ella
--     en WHERE, no solo para devolverla — revocarla rompe el panel admin
--     entero. Se mantiene, solo para 'authenticated'.
--   - accepts_cash, accepts_transfer, bank_alias, bank_cbu: leídos vía
--     relación embebida clubs(...)/clubs!inner(...) con el cliente de
--     SESIÓN en app/(player)/crear-partido/actions.ts,
--     app/(player)/clases/actions.ts y app/(player)/clases/[sessionId]/
--     page.tsx (el jugador necesita ver el alias/CBU del club para pagar
--     por transferencia). Se mantienen, solo para 'authenticated'.
--   - mp_access_token, mp_user_id, mp_email, mp_subscription_id,
--     finance_pin, subscription_status, trial_start_date, trial_end_date,
--     grace_period_end, past_due_since, retry_attempt, last_status_detail,
--     last_payment_attempt_at, last_payment_failure_notified_at,
--     last_webhook_request_id, next_billing_date, deactivation_reason:
--     TODOS los usos reales encontrados (grep exhaustivo, ~30 sitios) usan
--     createServiceClient()/admin/svc — nunca el cliente de sesión. Se
--     revocan sin reemplazo.
--   - No se encontró ningún select("*") sobre clubs vía el cliente de
--     sesión en todo el repo — un select("*") con columnas restringidas no
--     falla (PostgREST devuelve solo las columnas permitidas), así que esto
--     tampoco es un riesgo de regresión.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1) clubs: reemplazar el GRANT SELECT de tabla completa por columnas
--    explícitas. Un REVOKE SELECT (columna) sobre un grant de TABLA no
--    alcanza — hay que revocar el grant de tabla entero y re-otorgar solo
--    lo necesario.
-- ───────────────────────────────────────────────────────────────────────
revoke select on public.clubs from anon, authenticated;

-- Columnas públicas: página pública del club, disponibilidad, reservar,
-- listados de canchas/torneos/clases embebidos. Sin sesión.
grant select (
  id, name, slug, description, address, contact_phone, whatsapp,
  instagram, facebook, tiktok, business_hours, logo_url, cover_image_url,
  gallery_image_1, gallery_image_2, gallery_image_3, gallery_image_4,
  city, province, country, location,
  open_time, close_time, is_active,
  cancellation_policy, cancellation_hours,
  services, skip_trainings,
  deposit_type, deposit_value,
  created_at
) on public.clubs to anon, authenticated;
-- requires_deposit NO va acá: no existe hoy en producción. Cuando reservas
-- sin seña se despliegue, su propia migración (20260923100000) hace
-- `grant select (requires_deposit) on public.clubs to anon, authenticated;`
-- — un grant de columna puntual sobre esta misma tabla ya corregida, no un
-- nuevo grant de tabla completa. No hay conflicto entre ambas migraciones:
-- se pueden aplicar en cualquier orden entre sí.

-- Columnas adicionales SOLO para usuarios logueados (uso real confirmado
-- arriba): pertenencia de club (panel admin) y datos de transferencia.
grant select (
  owner_id, accepts_cash, accepts_transfer, bank_alias, bank_cbu
) on public.clubs to authenticated;

-- mp_access_token, mp_user_id, mp_email, mp_subscription_id, finance_pin,
-- subscription_status, trial_start_date, trial_end_date, grace_period_end,
-- past_due_since, retry_attempt, last_status_detail,
-- last_payment_attempt_at, last_payment_failure_notified_at,
-- last_webhook_request_id, next_billing_date, deactivation_reason:
-- SIN grant a anon/authenticated. Ya estaban bien en las migraciones que
-- históricamente los introdujeron; el problema nunca fue esas columnas
-- puntuales, fue el grant de tabla completa preexistente.

-- ───────────────────────────────────────────────────────────────────────
-- 2) superadmin_clubs_overview: revocar todo a anon/authenticated. Ningún
--    uso real la consulta fuera del service client (verificado).
-- ───────────────────────────────────────────────────────────────────────
revoke all on public.superadmin_clubs_overview from anon, authenticated;
grant select on public.superadmin_clubs_overview to service_role;

-- ───────────────────────────────────────────────────────────────────────
-- 3) service_role: sin cambios, confirmado explícitamente para que quede
--    documentado — service_role nunca pasa por column/row grants ni RLS
--    (bypassrls implícito del rol), así que ninguna sentencia de arriba lo
--    afecta. No hace falta un GRANT explícito adicional.
-- ───────────────────────────────────────────────────────────────────────
