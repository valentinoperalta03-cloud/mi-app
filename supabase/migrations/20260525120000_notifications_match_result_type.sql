-- Bootstrap notifications (si el proyecto no aplicó 20260420300000_notifications.sql)
-- y ampliar tipos para match_result (+ club_agenda alineado con TypeScript).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  match_id uuid references public.matches (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications
  for insert to authenticated
  with check (true);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated
  using (auth.uid() = user_id);

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (type in (
    'join_request',
    'join_approved',
    'join_rejected',
    'player_joined',
    'match_reminder',
    'result_pending',
    'match_result',
    'reservation_confirmed',
    'reservation_cancelled',
    'payment_approved',
    'payment_rejected',
    'level_up',
    'match_cancelled',
    'match_owner_changed',
    'new_follower',
    'now_friends',
    'new_message',
    'group_message',
    'added_to_group',
    'tournament_event',
    'club_agenda'
  ));
