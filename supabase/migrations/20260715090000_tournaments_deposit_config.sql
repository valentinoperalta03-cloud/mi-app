-- Senas parametrizables por torneo (independiente de la sena de cancha).
-- requires_deposit habilita/deshabilita explicitamente la sena por torneo;
-- si es false, se cobra price_per_pair completo (comportamiento previo).
alter table public.tournaments
  add column if not exists requires_deposit boolean not null default false,
  add column if not exists deposit_type text
    check (deposit_type in ('percentage', 'fixed')),
  add column if not exists deposit_value numeric not null default 0;
