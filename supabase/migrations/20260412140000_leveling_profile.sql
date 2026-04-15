-- Nivelación y evolución. Ejecutar en Supabase si aún no existen las columnas/tablas.

alter table public.profiles
  add column if not exists is_leveled boolean not null default false;

alter table public.profiles
  add column if not exists base_level text;

alter table public.profiles
  add column if not exists dominant_hand text;

alter table public.profiles
  add column if not exists play_position text;

alter table public.profiles
  add column if not exists play_schedule text;

create table if not exists public.level_evolution (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  score numeric not null,
  category text not null,
  base_level text,
  penalty_applied boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists level_evolution_user_created_idx
  on public.level_evolution (user_id, created_at desc);

alter table public.level_evolution enable row level security;

create policy "level_evolution_select_own" on public.level_evolution
  for select to authenticated using (auth.uid() = user_id);

create policy "level_evolution_insert_own" on public.level_evolution
  for insert to authenticated with check (auth.uid() = user_id);

-- Opcional: usuarios ya categorizados manualmente
-- update public.profiles set is_leveled = true where category is not null and is_leveled = false;
