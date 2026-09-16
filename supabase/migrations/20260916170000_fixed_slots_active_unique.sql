-- Una sola regla de turno fijo ACTIVA por cancha + día de semana + hora.
-- court_id, day_of_week y start_time son NOT NULL. Las reglas inactivas quedan
-- fuera del predicado, así que el histórico dado de baja no bloquea recrearla.
-- Requiere 20260916160000 aplicada: si todavía hay duplicados activos, esta
-- migración falla sin crear nada.

create unique index if not exists fixed_slots_active_court_day_time_uniq
  on public.fixed_slots (court_id, day_of_week, start_time)
  where is_active = true;
