-- B2B SaaS: suscripcion mensual de clubes ($50.000 ARS) + senas parametrizables por cancha.
--
-- No existe una tabla "reservations" en este proyecto: las reservas de cancha
-- son filas de `matches` con match_type = 'reservation', asi que las columnas
-- financieras se agregan una sola vez ahi (ver lib/fixed-slot-generator.ts).

-- ==================== CLUBS: suscripcion ====================
alter table public.clubs
  add column if not exists subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'past_due', 'paused')),
  add column if not exists trial_start_date timestamptz not null default now(),
  add column if not exists trial_end_date timestamptz not null default (now() + interval '15 days'),
  add column if not exists next_billing_date timestamptz,
  add column if not exists mp_subscription_id text;

create index if not exists clubs_subscription_status_idx
  on public.clubs (subscription_status);

-- Postgres RLS no puede ocultar columnas puntuales fila por fila cuando ya
-- existe una policy publica de SELECT (como "Clubes visibles para todos").
-- Por eso las columnas de facturacion se protegen con GRANT/REVOKE a nivel
-- columna: se le quita el SELECT a anon/authenticated y solo queda accesible
-- para service_role, que ya se usa en este proyecto para operaciones
-- privilegiadas (dashboard admin, webhook de MP). Ver CLAUDE.md: "Server
-- client... usa service role key para operaciones privilegiadas".
revoke select (
  subscription_status,
  trial_start_date,
  trial_end_date,
  next_billing_date,
  mp_subscription_id
) on public.clubs from anon, authenticated;

-- ==================== COURTS: senas parametrizables ====================
alter table public.courts
  add column if not exists requires_deposit boolean not null default false,
  add column if not exists deposit_type text
    check (deposit_type in ('percentage', 'fixed')),
  add column if not exists deposit_value numeric not null default 0;

-- ==================== MATCHES (incluye reservas de cancha) ====================
-- `total_price` (integer) y `payment_status` (text: paid/pending/cash_pending/
-- transfer_pending) ya existen y estan en uso en toda la app: no se tocan.
-- `organizer_id` no se agrega: `owner_id` (FK a profiles, ON DELETE CASCADE)
-- ya cumple ese rol y es el campo que usan las policies existentes.
alter table public.matches
  add column if not exists amount_paid numeric not null default 0,
  add column if not exists amount_pending numeric not null default 0,
  add column if not exists financial_status text not null default 'unpaid'
    check (financial_status in ('unpaid', 'partially_paid', 'fully_paid'));

create index if not exists matches_financial_status_idx
  on public.matches (financial_status);

-- ==================== TOURNAMENT_REGISTRATIONS ====================
-- `payment_status` (pending/approved/cancelled/refunded) sigue en uso por
-- app/(player)/torneos, app/admin/torneos y el webhook de MP: no se elimina.
-- financial_status es un esquema adicional para trackear senas parciales.
alter table public.tournament_registrations
  add column if not exists total_price numeric,
  add column if not exists amount_paid numeric not null default 0,
  add column if not exists amount_pending numeric not null default 0,
  add column if not exists financial_status text not null default 'unpaid'
    check (financial_status in ('unpaid', 'partially_paid', 'fully_paid'));

create index if not exists tournament_registrations_financial_status_idx
  on public.tournament_registrations (financial_status);

-- ==================== RLS: lectura de financial_status ====================
-- matches: la policy publica "Partidos visibles para todos" (select true) ya
-- expone financial_status a cualquier autenticado, igual que payment_status
-- hoy. No se restringe mas para no romper el descubrimiento de partidos.
--
-- tournament_registrations: ya cumple lo pedido sin cambios. Las policies
-- existentes acotan el SELECT a la fila propia o al admin del club:
--   tournament_registrations_select_own   -> player1_id/player2_id = auth.uid()
--   tournament_registrations_select_admin -> club del torneo pertenece al owner
--
-- Ninguna de las dos tablas tiene policies de UPDATE para el admin del club
-- (los flujos de admin ya escriben via service_role en app/admin/**/actions.ts
-- y en app/api/mp/webhook), asi que no se agregan policies de UPDATE nuevas
-- para mantener el mismo modelo de seguridad que ya usa el proyecto.
