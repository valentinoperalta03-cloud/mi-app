-- Nivelacion inicial + base para evolucion competitiva tipo ELO.

alter table public.level_evolution
  add column if not exists old_level double precision;

alter table public.level_evolution
  add column if not exists new_level double precision;

alter table public.level_evolution
  add column if not exists source text default 'quiz';

alter table public.level_evolution
  add column if not exists opponent_avg_level double precision;

alter table public.level_evolution
  add column if not exists result text;

alter table public.level_evolution
  add column if not exists k_factor double precision;

alter table public.level_evolution
  add column if not exists delta double precision;
