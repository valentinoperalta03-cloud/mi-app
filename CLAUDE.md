# Padelibre — Claude Code Instructions

## 1. Project
SaaS B2B2C para clubes y jugadores de pádel en Argentina.
Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS · Supabase · Mercado Pago · Capacitor 8 (iOS/Android)

## 2. Business rules (non-negotiable)
- Solo pádel. Sin otros deportes.
- Clubes pagan ARS $50.000/mes. Trial 15 días.
- Padelibre NO cobra comisión. 100% de reservas va al club via MP.
- Clubes pueden configurar seña (monto fijo o porcentaje).
- Experiencias separadas: club owner en /admin/*, jugador en /home y rutas de jugador.

## 3. Tipos de match (crítico)
- `match_type: 'reservation'` → reserva de cancha. Solo visible en /reservas del jugador y /admin/reservas. NUNCA en feed público.
- `match_type: 'amistoso'` → partido abierto. Visible en /buscar-partido y /[slug]/partidos.
- ELO eliminado completamente. No usar: level_logic, level-evolution-elo, technical-score, apply-match-technical-rating, match-level, matchResults, playerRatings.
- `created_by_club: true` → partido abierto creado desde el panel admin del club.
- `guest_name` en match_participants → jugador agregado por el club sin cuenta en la app.

## 4. Flujo de pagos
- Reserva de cancha: jugador paga seña online via MP → cancha confirmada → saldo restante se paga en el club.
- Partido abierto (jugadores): el 4to jugador paga la seña completa → cancha confirmada para todos.
- Partido abierto (club): sin pago de seña, los jugadores se anotan gratis.
- Webhook MP en /api/mp/webhook-unified maneja todos los pagos.

## 5. Rutas principales

/[slug] → página pública del club
/[slug]/reservar → reserva de cancha (jugador logueado)
/[slug]/partidos → abrir/unirse a partidos del club
/admin/* → panel del club (owner)
/admin/reservas → gestión reservas + partidos abiertos (2 tabs)
/admin/config/servicios → servicios del club (20 opciones)
/home → dashboard del jugador
/buscar-partido → feed de partidos abiertos por ciudad
/reservas → reservas + partidos del jugador (2 tabs)
/comunidad/para-ti → feed de posts + partidos abiertos
/comunidad/jugadores → jugadores agrupados por categoría
/completar-perfil → onboarding del jugador (obligatorio)


## 6. User roles
- Club owner: /admin/* (middleware protege estas rutas)
- Jugador: /home y rutas de jugador
- No mezclar ni bypassear el middleware.

## 7. Database
Todos los nombres de tablas vienen de `lib/db-tables.ts`. Nunca hardcodear.
Tablas principales activas:
- profiles, clubs, courts, court_time_ranges
- matches, match_participants, match_join_requests
- payments, notifications, posts
- user_favorites, match_feedback
- training_blocks, court_blocks
- tournaments, tournament_participants

Tablas legacy (existen en DB pero ya no se escriben):
- matchResults, matchResultConfirmations, playerRatings, levelEvolution

## 8. Módulos clave

lib/auth-redirect.ts → routing post-login
lib/db-tables.ts → nombres de tablas
lib/court-slots.ts → disponibilidad de canchas
lib/deposit-utils.ts → cálculo de seña
lib/mercadopago.ts → Mercado Pago
lib/mp-preference.ts → crear preferencia MP
lib/notifications.ts → push notifications
lib/matches.ts → queries de matches
lib/club-notify.ts → notificar al club
lib/datetime-ar.ts → timezone Argentina (-03:00)
lib/match-conflict.ts → cancelar partido abierto al reservar cancha
lib/admin/onboarding-status.ts → estado del onboarding del admin (9 fases)


## 9. Supabase clients
- Server Components/actions → createClient()
- Service role (bypass RLS) → createServiceClient()
- Middleware → middleware client
- Nunca usar browser client en Server Components.

## 10. Sistema visual
Admin: navy #0A1628, lima #CCFF00, Space Grotesk + IBM Plex Mono
Jugador: variables CSS (--bg-app, --bg-card, --text-primary, etc.)
Página pública /[slug]: navy #0A1628, misma estética que admin

## 11. Reglas de código
- Leer archivos relevantes antes de cambiar cualquier cosa.
- No modificar archivos ni funcionalidades no relacionadas con la tarea.
- No hacer refactors "por limpieza" salvo que sean necesarios para el cambio.
- Reusar componentes y módulos existentes antes de crear nuevos.
- Cambios mínimos y específicos al feature pedido.
- No cambiar estructura de DB sin necesidad explícita.
- No exponer service-role credentials al cliente.
- Todo el UI en español rioplatense.
- Preservar comportamiento existente salvo que se pida cambiarlo.
- Sé conciso. No expliques código obvio ni repitas contexto.
- Si una decisión puede afectar pagos, autenticación, permisos, DB o lógica existente → detenerse y preguntar antes de asumir.
- Para cambios visuales o simples → implementar directamente sin pedir confirmación innecesaria.

## 12. Efficiency
- No leer el repositorio completo.
- Buscar primero archivos directamente relacionados con la tarea.
- Leer documentación adicional solo cuando sea relevante.
- No repetir búsquedas de archivos ya inspeccionados.
- Antes de crear algo nuevo, buscar si ya existe una implementación reutilizable.

## 13. Antes de codear
1. Leer los archivos relevantes.
2. Identificar patrones existentes.
3. Hacer el cambio más pequeño y correcto.
4. Correr lint/build cuando el cambio lo requiera.
5. Reportar qué cambió y qué queda pendiente.