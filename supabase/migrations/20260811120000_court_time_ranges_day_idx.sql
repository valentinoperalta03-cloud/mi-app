create index if not exists court_time_ranges_day_of_week_idx
  on court_time_ranges(court_id, day_of_week);
