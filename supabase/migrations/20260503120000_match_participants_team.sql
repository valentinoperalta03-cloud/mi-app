alter table public.match_participants
  add column if not exists team smallint check (team is null or team in (1, 2));
