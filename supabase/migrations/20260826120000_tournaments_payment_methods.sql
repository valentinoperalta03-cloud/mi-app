-- Metodos de pago configurables por torneo: el club elige si acepta Mercado
-- Pago, efectivo y/o transferencia. La sena por MP sigue usando el sistema
-- existente (requires_deposit/deposit_type/deposit_value) — no se duplica.
alter table public.tournaments add column if not exists accepts_mp boolean not null default true;
alter table public.tournaments add column if not exists accepts_cash boolean not null default false;
alter table public.tournaments add column if not exists accepts_transfer boolean not null default false;
alter table public.tournaments add column if not exists transfer_alias text default null;
