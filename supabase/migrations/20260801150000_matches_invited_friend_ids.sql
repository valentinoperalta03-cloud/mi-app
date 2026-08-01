alter table public.matches
  add column if not exists invited_friend_ids uuid[] not null default '{}';
