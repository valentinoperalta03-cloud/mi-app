-- Horarios globales del club, días cerrados, índice único de slot activo y bandera de aviso partido incompleto.

alter table public.clubs
  add column if not exists open_time time,
  add column if not exists close_time time;

update public.clubs
set
  open_time = coalesce(open_time, time '09:00'),
  close_time = coalesce(close_time, time '22:30');

alter table public.clubs
  alter column open_time set default time '09:00',
  alter column close_time set default time '22:30';

alter table public.clubs
  alter column open_time set not null,
  alter column close_time set not null;

create table if not exists public.club_closed_days (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  closed_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (club_id, closed_date)
);

alter table public.club_closed_days enable row level security;

drop policy if exists "Club owner can manage closed days" on public.club_closed_days;

create policy "Club owner can manage closed days"
  on public.club_closed_days for all to authenticated
  using (club_id in (select id from public.clubs where owner_id = auth.uid()))
  with check (club_id in (select id from public.clubs where owner_id = auth.uid()));

create unique index if not exists unique_court_slot_active
  on public.matches (court_id, scheduled_date, scheduled_time)
  where lower(coalesce(match_status, '')) <> 'cancelled';

alter table public.matches add column if not exists incomplete_reminder_sent boolean not null default false;

drop policy if exists "Anyone can read club closed days" on public.club_closed_days;

create policy "Anyone can read club closed days"
  on public.club_closed_days for select
  to anon, authenticated
  using (true);
