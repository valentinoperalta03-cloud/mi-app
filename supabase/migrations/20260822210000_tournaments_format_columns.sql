-- Configuración específica por formato de torneo (americano/eliminación/peña):
-- si termina con finales o solo ranking, formato y duración de partidos,
-- si el bracket de eliminación es de varios días, cantidad de canchas y
-- descripción libre de comida/bebida para peñas.
alter table public.tournaments
  add column if not exists has_finals boolean default true;
alter table public.tournaments
  add column if not exists match_duration_minutes integer default null;
alter table public.tournaments
  add column if not exists match_format text default 'set'; -- 'set' | 'tiempo'
alter table public.tournaments
  add column if not exists num_courts integer default null;
alter table public.tournaments
  add column if not exists multi_day boolean default false;
alter table public.tournaments
  add column if not exists food_included text default null;
