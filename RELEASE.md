# Checklist de release (main → producción)

Antes de mergear a `main` y deployar a producción (`padelibre.online` via proyecto Vercel único):

1. **`npm run build`** — debe completar sin errores en local.
2. **`npm run lint`** — sin errores (warnings revisados si aplican).
3. **Migraciones SQL** — aplicar en Supabase (Staging/Preview primero si existe, luego producción) cualquier archivo nuevo en `supabase/migrations/`.
4. **Variables de entorno** — si el cambio introduce o renombra vars, documentarlas en `.env.example` y cargarlas en Vercel (Production y Preview según corresponda).
5. **Smoke manual** de flujos críticos:
   - Crear partido y ver que aparece en listados.
   - Unirse a un partido abierto (flujo completo).
   - Pago Mercado Pago (sandbox/test en preview).

## Branches

- **`main`** → producción.
- **`develop`** → previews automáticos (recomendado).
- Features en branches cortos + PR a `main` o `develop`.

## Vercel

- Un solo proyecto productivo conectado al repo (evitar duplicar proyectos para el mismo código).
- **Production Branch** = `main` en Settings → Git.

## Último deploy guardado

- Fecha: 2026-05-05
- Supabase project: `ffdqizxmrrekmgvpmrcg`
- Migración aplicada: `padelibre_structural_match_payment_rpc`
- Deployment id: `dpl_F3wRfG5WsSvPGsbyeQJwU5j3QQz6`
- Inspector: https://vercel.com/valentinoperalta03-clouds-projects/mi-app-ksox/F3wRfG5WsSvPGsbyeQJwU5j3QQz6
- URL deploy: https://mi-app-ksox-3ljwuuksj-valentinoperalta03-clouds-projects.vercel.app
- Alias producción: https://www.padelibre.online
