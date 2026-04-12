-- Ejecutar en Supabase SQL Editor si aún no existen las tablas.
-- Habilitá Realtime para `messages` en Dashboard → Database → Replication.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  match_id uuid references public.matches (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_user_id_idx on public.posts (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  constraint messages_no_self check (sender_id <> receiver_id)
);

create index if not exists messages_pair_idx on public.messages (sender_id, receiver_id, created_at desc);
create index if not exists messages_receiver_idx on public.messages (receiver_id, created_at desc);

alter table public.posts enable row level security;
alter table public.messages enable row level security;

create policy "posts_select_authenticated" on public.posts for select to authenticated using (true);

create policy "posts_insert_own" on public.posts for insert to authenticated
  with check (auth.uid() = user_id);

create policy "messages_select_participant" on public.messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "messages_insert_sender" on public.messages for insert to authenticated
  with check (auth.uid() = sender_id);

-- Realtime: en el dashboard, agregá la tabla `messages` a la publicación `supabase_realtime`.
