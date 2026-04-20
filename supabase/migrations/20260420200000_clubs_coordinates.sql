alter table public.clubs
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7);

-- Coordenadas de ejemplo para Club Funes (Rosario, Argentina)
update public.clubs
set latitude = -32.9168, longitude = -60.6830
where name ilike '%funes%';
