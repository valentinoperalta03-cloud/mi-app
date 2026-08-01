alter table public.match_join_requests
  add column if not exists voting_closed boolean not null default false;
