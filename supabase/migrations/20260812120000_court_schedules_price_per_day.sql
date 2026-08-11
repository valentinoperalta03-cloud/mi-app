-- Permite precios distintos por día de semana en la rama de precios de
-- court_schedules (day_of_week ya no tiene que ser NULL para esas filas).
-- Las filas existentes con day_of_week IS NULL siguen siendo válidas — se
-- usan como fallback global cuando no hay precio específico para un día.
-- El original (migración 20260428205000) se creó como ÍNDICE único, no como
-- constraint de tabla — "drop constraint" sobre ese nombre sería un no-op y
-- dejaría el índice viejo activo, bloqueando insertar el mismo start_time en
-- distintos day_of_week. Hay que dropear el índice.
drop index if exists public.court_schedules_court_id_start_time_key;

create unique index if not exists court_schedules_court_id_day_of_week_start_time_key
  on public.court_schedules (court_id, day_of_week, start_time)
  where start_time is not null;
