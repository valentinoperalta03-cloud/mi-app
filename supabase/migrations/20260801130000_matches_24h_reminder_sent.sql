alter table public.matches
  add column if not exists match_24h_reminder_sent boolean default false;
