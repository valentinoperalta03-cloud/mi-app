create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'join_request',
    'join_approved',
    'join_rejected',
    'player_joined',
    'match_reminder',
    'result_pending',
    'reservation_confirmed',
    'reservation_cancelled',
    'payment_approved',
    'payment_rejected',
    'level_up'
  )),
  title text not null,
  body text not null,
  match_id uuid references public.matches(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select to authenticated using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications
  for update to authenticated using (auth.uid() = user_id);
create policy "notifications_insert" on public.notifications
  for insert to authenticated with check (true);
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists notifications_user_id_idx
  on public.notifications(user_id, created_at desc);
