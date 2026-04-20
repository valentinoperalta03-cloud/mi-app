alter table public.profiles
  add column if not exists location text,
  add column if not exists notifications_enabled boolean default true,
  add column if not exists is_public boolean default true;
