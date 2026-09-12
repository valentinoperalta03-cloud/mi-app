-- Grace period para pagos de suscripcion rechazados (past_due). Separamos
-- explicitamente estos campos de next_billing_date: next_billing_date es la
-- proxima cuota mensual que informa el preapproval de MP (no cambia por un
-- rechazo), mientras que past_due_since/grace_period_end son el plazo propio
-- de PadeLibre para mantener acceso mientras el club regulariza el pago.
--
-- retry_attempt/last_status_detail/last_payment_attempt_at son un espejo
-- rapido del ultimo intento (evita un join a subscription_payment_attempts
-- para mostrar el estado en el panel). last_payment_failure_notified_at
-- controla el anti-spam de avisos (no repetir antes de 48hs).
alter table public.clubs
  add column if not exists past_due_since timestamptz,
  add column if not exists grace_period_end timestamptz,
  add column if not exists retry_attempt integer not null default 0,
  add column if not exists last_status_detail text,
  add column if not exists last_payment_attempt_at timestamptz,
  add column if not exists last_payment_failure_notified_at timestamptz;

-- No hace falta revocar select/update para anon/authenticated: desde
-- 20260713130000_fix_clubs_billing_column_grants.sql el grant de columnas es
-- allowlist (deny by default), asi que estas columnas nuevas ya quedan
-- accesibles solo para service_role, igual que subscription_status.

-- Indice parcial para que el cron de vencimiento de grace period
-- (subscription_status = 'past_due' AND grace_period_end <= now()) no tenga
-- que escanear toda la tabla clubs.
create index if not exists clubs_past_due_grace_period_idx
  on public.clubs (grace_period_end)
  where subscription_status = 'past_due'
    and grace_period_end is not null;
