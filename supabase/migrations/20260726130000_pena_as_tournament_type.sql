-- Las peñas dejan de ser un módulo separado y pasan a ser un tipo de torneo
-- más (reemplaza a 'mixing', que nunca llegó a producción). Se elimina el
-- esquema separado de penas/pena_registrations/pena_round_matches y se
-- extiende tournaments/tournament_registrations con lo necesario.

-- ---------------------------------------------------------------------------
-- Eliminar el módulo separado de peñas
-- ---------------------------------------------------------------------------
drop table if exists public.pena_round_matches cascade;
drop table if exists public.pena_registrations cascade;
drop table if exists public.penas cascade;

-- ---------------------------------------------------------------------------
-- tournaments: reemplazar 'mixing' por 'pena' en tournament_type
-- ---------------------------------------------------------------------------
alter table public.tournaments
  drop constraint if exists tournaments_tournament_type_check;

-- Backfill antes de aplicar el nuevo constraint (sin torneos 'mixing' en
-- producción hasta la fecha, pero se cubre el caso por las dudas).
update public.tournaments set tournament_type = 'pena' where tournament_type = 'mixing';

alter table public.tournaments
  add constraint tournaments_tournament_type_check
  check (tournament_type in ('americano', 'eliminacion', 'pena'));

-- ---------------------------------------------------------------------------
-- tournaments: columnas específicas de peña
-- ---------------------------------------------------------------------------
alter table public.tournaments
  add column if not exists what_includes text[] default '{}',
  add column if not exists game_format text,
  add column if not exists is_individual boolean default false;

update public.tournaments set is_individual = true where tournament_type = 'pena';
