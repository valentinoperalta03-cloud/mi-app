create table if not exists public.group_chats (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid not null references auth.users (id) on delete cascade,
  match_id uuid references public.matches (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_chat_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group_chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  unique(group_id, user_id)
);

create table if not exists public.group_chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group_chats (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists group_chats_match_id_idx on public.group_chats (match_id);
create index if not exists group_chat_members_group_idx on public.group_chat_members (group_id);
create index if not exists group_chat_members_user_idx on public.group_chat_members (user_id);
create index if not exists group_chat_messages_group_created_idx on public.group_chat_messages (group_id, created_at desc);

alter table public.group_chats enable row level security;
alter table public.group_chat_members enable row level security;
alter table public.group_chat_messages enable row level security;

create policy "group_chats_select_members" on public.group_chats
for select to authenticated
using (
  exists (
    select 1 from public.group_chat_members m
    where m.group_id = group_chats.id
      and m.user_id = auth.uid()
  )
);

create policy "group_chats_insert_owner" on public.group_chats
for insert to authenticated
with check (created_by = auth.uid());

create policy "group_chat_members_select_members" on public.group_chat_members
for select to authenticated
using (
  exists (
    select 1 from public.group_chat_members mine
    where mine.group_id = group_chat_members.group_id
      and mine.user_id = auth.uid()
  )
);

create policy "group_chat_members_insert_admin_only" on public.group_chat_members
for insert to authenticated
with check (
  exists (
    select 1 from public.group_chats g
    where g.id = group_chat_members.group_id
      and g.created_by = auth.uid()
  )
);

create policy "group_chat_members_update_admin_only" on public.group_chat_members
for update to authenticated
using (
  exists (
    select 1 from public.group_chats g
    where g.id = group_chat_members.group_id
      and g.created_by = auth.uid()
  )
);

create policy "group_chat_messages_select_members" on public.group_chat_messages
for select to authenticated
using (
  exists (
    select 1 from public.group_chat_members m
    where m.group_id = group_chat_messages.group_id
      and m.user_id = auth.uid()
  )
);

create policy "group_chat_messages_insert_members" on public.group_chat_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.group_chat_members m
    where m.group_id = group_chat_messages.group_id
      and m.user_id = auth.uid()
  )
);
