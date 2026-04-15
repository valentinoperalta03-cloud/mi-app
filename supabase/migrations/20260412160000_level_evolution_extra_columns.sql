-- Tablas creadas a mano a veces solo tienen user_id, score, category.
-- Si querés historial de penalización / nivel base en cada punto, ejecutá esto:

alter table public.level_evolution add column if not exists penalty_applied boolean not null default false;
alter table public.level_evolution add column if not exists base_level text;
