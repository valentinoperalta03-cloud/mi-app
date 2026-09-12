-- Historial de cobros de suscripcion mensual (MP authorized_payment).
--
-- Diseno: UNA FILA POR VERSION REAL observada del authorized_payment, no una
-- fila mutable por invoice. Un mismo mp_authorized_payment_id evoluciona
-- (scheduled -> rejected intento 1 -> rejected intento 2 -> approved) y cada
-- version se guarda como fila propia para no perder el historial de
-- reintentos. La idempotencia es UNIQUE(mp_authorized_payment_id,
-- mp_last_modified): una reentrega identica del mismo webhook (mismo
-- last_modified de MP) no duplica fila; un cambio real de estado si.
--
-- mp_last_modified (authorized_payment.last_modified de MP) es ademas uno de
-- los criterios que usa el codigo para descartar webhooks fuera de orden:
-- solo se procesa un evento si su last_modified es mas nuevo que el ultimo
-- ya registrado para ese mp_authorized_payment_id.
--
-- payment.id (mp_payment_id) puede no existir todavia (estado "scheduled",
-- payment:{}), por eso es nullable y no forma parte de la unicidad.
-- first_attempted_at/last_attempted_at tambien son nullable: un
-- authorized_payment "scheduled" sin intento de debito real todavia no tiene
-- fecha de intento (distinto de first_seen_at, que es cuando PadeLibre vio
-- por primera vez ese authorized_payment, sea cual sea su estado).
create table if not exists public.subscription_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  mp_preapproval_id text not null,
  mp_authorized_payment_id text not null,
  mp_payment_id text,
  status text not null,
  status_detail text,
  retry_attempt integer not null default 0,
  amount numeric(12,2),
  currency text not null default 'ARS',
  debit_date timestamptz,
  mp_last_modified timestamptz not null,
  first_seen_at timestamptz not null default now(),
  first_attempted_at timestamptz,
  last_attempted_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (mp_authorized_payment_id, mp_last_modified)
);

create index if not exists subscription_payment_attempts_club_id_idx
  on public.subscription_payment_attempts (club_id);
create index if not exists subscription_payment_attempts_preapproval_idx
  on public.subscription_payment_attempts (mp_preapproval_id);
-- Para traer la ultima version conocida de un authorized_payment (orden por
-- last_modified descendente) al decidir si un webhook entrante es mas nuevo.
create index if not exists subscription_payment_attempts_authorized_payment_idx
  on public.subscription_payment_attempts (mp_authorized_payment_id, mp_last_modified desc);

alter table public.subscription_payment_attempts enable row level security;

-- Deny-by-default explicito ademas de RLS: esta tabla es historial de
-- facturacion, solo service_role opera (el webhook y el cron usan
-- createServiceClient(), que bypassea RLS). Si mas adelante el panel del
-- club necesita mostrar el historial directo al owner, se agrega una RPC
-- SECURITY DEFINER filtrada (mismo patron que get_clubs_mp_connected), nunca
-- un grant directo sobre la tabla.
revoke all on public.subscription_payment_attempts from anon, authenticated;

drop policy if exists "subscription_payment_attempts no access" on public.subscription_payment_attempts;
create policy "subscription_payment_attempts no access" on public.subscription_payment_attempts for all using (false);
