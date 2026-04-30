create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create index if not exists idx_blocked_users_club on public.blocked_users (club_id);
create index if not exists idx_blocked_users_user on public.blocked_users (user_id);

alter table public.blocked_users enable row level security;

drop policy if exists "blocked_users_owner_select" on public.blocked_users;
create policy "blocked_users_owner_select" on public.blocked_users
  for select to authenticated
  using (
    exists (
      select 1
      from public.clubs c
      where c.id = blocked_users.club_id
        and c.owner_id = auth.uid()
    )
  );

drop policy if exists "blocked_users_user_select_self" on public.blocked_users;
create policy "blocked_users_user_select_self" on public.blocked_users
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "blocked_users_owner_insert" on public.blocked_users;
create policy "blocked_users_owner_insert" on public.blocked_users
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.clubs c
      where c.id = blocked_users.club_id
        and c.owner_id = auth.uid()
    )
  );
