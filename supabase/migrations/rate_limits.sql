create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 1,
  window_start timestamptz not null default now()
);

alter table public.rate_limits disable row level security;

create index if not exists idx_rate_limits_key on public.rate_limits (key);
