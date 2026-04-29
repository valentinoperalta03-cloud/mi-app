alter table public.court_schedules
  add column if not exists start_time time,
  add column if not exists price_override numeric(10,2);

create unique index if not exists court_schedules_court_id_start_time_key
  on public.court_schedules(court_id, start_time)
  where start_time is not null;
