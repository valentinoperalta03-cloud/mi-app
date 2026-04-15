-- Nivel técnico 0–7 y columnas de historial para gráficos.

alter table public.profiles
  add column if not exists technical_score double precision;

comment on column public.profiles.technical_score is
  'Escala competitiva 0.0–7.0; fuente de verdad del nivel.';

alter table public.level_evolution
  add column if not exists previous_score double precision;

alter table public.level_evolution
  add column if not exists new_score double precision;
