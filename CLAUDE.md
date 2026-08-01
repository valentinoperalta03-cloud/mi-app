# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Next.js Version

This project uses **Next.js 16.2.2**, which has breaking changes from earlier versions. APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint (eslint-config-next)
npm start        # Start production server
```

No test suite is configured.

## Architecture

**FaltaUno** is a padel (paddle tennis) club management and matchmaking app. All UI is in Spanish. The app uses Next.js App Router with Supabase for database, auth, and real-time features.

### Route Groups & User Roles

Role is determined at login: if a user owns a club (`clubs.owner_id`), they land on `/admin/dashboard`; otherwise `/home`. The middleware (`middleware.ts`) enforces this separation — admins can't access jugador routes (except `/perfil`) and vice versa.

| Area | Routes | Audience |
|------|--------|----------|
| Player app | `/home`, `/partidos`, `/reservas`, `/clubes`, `/comunidad`, `/perfil`, `/notificaciones` | Registered players |
| Admin dashboard | `/admin/dashboard`, `/admin/canchas`, `/admin/reservas`, `/admin/jugadores`, `/admin/analytics`, `/admin/finanzas`, `/admin/config` | Club owners |
| Public / auth | `/login`, `/verificar-email`, `/auth/*` | Unauthenticated |

### Supabase Integration

Two client variants live in `utils/supabase/`:
- **Server client** — used in Server Components and API routes (uses service role key for privileged operations)
- **Middleware client** — `createMiddlewareClient` in `utils/supabase/middleware.ts`, used by `middleware.ts` to refresh sessions and read cookies

Never use the browser client in Server Components. When redirecting in middleware, always copy Supabase session cookies via `redirectPreservingSupabaseCookies` (already defined in `middleware.ts`) to avoid session loss or redirect loops.

### Database Tables

All table names are centralized in [`lib/db-tables.ts`](lib/db-tables.ts). Always import from there instead of using raw strings. Key tables:

- `profiles` — user data and level/ELO rating
- `clubs` / `courts` / `court_schedules` / `court_blocks` — club and court management
- `matches` / `match_players` / `match_participants` / `match_join_requests` / `match_join_votes` — match lifecycle
- `match_results` / `match_result_confirmations` / `player_ratings` — post-match scoring
- `payments` — Mercado Pago transactions
- `messages` — real-time chat (Realtime must be enabled in Supabase dashboard)
- `notifications` / `posts` / `user_favorites` / `level_evolution` — social features

### Key `lib/` Modules

| File | Responsibility |
|------|---------------|
| `auth-redirect.ts` | `resolveHomePath` (role detection), path-type guards |
| `db-tables.ts` | Single source of truth for Supabase table names |
| `level-logic.ts` / `level-evolution-elo.ts` | Player ELO / level calculation |
| `technical-score.ts` / `apply-match-technical-rating.ts` | Post-match skill rating |
| `court-slots.ts` | Court availability slot computation |
| `mercadopago.ts` | Payment processing (100% to the club, no per-transaction fee) |
| `notifications.ts` | In-app notification creation helpers |
| `matches.ts` / `match-level.ts` | Match filtering and level-based matching |

### Payments

PadeLibre is B2B SaaS: clubs pay a fixed **$50,000 ARS/month subscription** (see `app/api/mp/subscriptions/`), and there are no per-transaction commissions. 100% of every reservation payment goes directly to the club's own Mercado Pago account — PadeLibre never takes a cut. Clubs can optionally require a deposit (seña) to confirm a reservation, configured per club via `clubs.deposit_type` / `clubs.deposit_value` (see `lib/deposit-utils.ts`); when unset, the player pays the full price upfront. API routes live under `app/api/mp/`. Test credentials are in `.env.local`; production keys are separate.

### AI Chatbot

An in-app padel/app-specific chatbot is served from `app/api/ai/` using the Anthropic API. The key is in `.env`.

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Mercado Pago keys (access token + public key, test and prod)
- `ANTHROPIC_API_KEY` (in `.env`)
- `INVITE_SECRET` — firma HMAC de los links de invitación a partidos privados (`lib/invite-token.ts`)
