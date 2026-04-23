create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique(sender_id, receiver_id)
);

alter table public.friend_requests enable row level security;

create policy "friend_requests_select" on public.friend_requests
  for select to authenticated using (
    auth.uid() = sender_id or auth.uid() = receiver_id
  );

create policy "friend_requests_insert" on public.friend_requests
  for insert to authenticated with check (auth.uid() = sender_id);

create policy "friend_requests_update" on public.friend_requests
  for update to authenticated using (auth.uid() = receiver_id);

create policy "friend_requests_delete" on public.friend_requests
  for delete to authenticated using (
    auth.uid() = sender_id or auth.uid() = receiver_id
  );
