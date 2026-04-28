drop table if exists public.group_chat_messages cascade;
drop table if exists public.group_chat_members cascade;
drop table if exists public.group_chats cascade;

create table public.group_chats (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid not null references auth.users (id) on delete cascade,
  match_id uuid references public.matches (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_chat_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group_chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table public.group_chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group_chats (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create index group_chats_match_id_idx on public.group_chats (match_id);
create index group_chat_members_group_idx on public.group_chat_members (group_id);
create index group_chat_members_user_idx on public.group_chat_members (user_id);
create index group_chat_messages_group_created_idx on public.group_chat_messages (group_id, created_at desc);

alter table public.group_chats disable row level security;
alter table public.group_chat_members disable row level security;
alter table public.group_chat_messages disable row level security;
