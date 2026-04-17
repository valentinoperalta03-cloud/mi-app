create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mp_preference_id text,
  mp_payment_id text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','refunded','cancelled')),
  amount numeric(10,2) not null,
  marketplace_fee numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "payments_select_own" on public.payments
  for select to authenticated using (auth.uid() = user_id);

create policy "payments_insert_own" on public.payments
  for insert to authenticated with check (auth.uid() = user_id);

create policy "payments_update_own" on public.payments
  for update to authenticated using (auth.uid() = user_id);

alter table public.clubs
  add column if not exists mp_access_token text,
  add column if not exists mp_user_id text;
