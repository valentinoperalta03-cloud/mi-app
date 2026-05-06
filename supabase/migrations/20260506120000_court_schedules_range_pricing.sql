-- Price bands (mañana/tarde/noche): nullable day + optional open/close on band rows
alter table public.court_schedules
  alter column day_of_week drop not null;

alter table public.court_schedules
  alter column open_time drop not null;

alter table public.court_schedules
  alter column close_time drop not null;

alter table public.court_schedules
  add column if not exists end_time time without time zone,
  add column if not exists range_name text;
