-- Orden manual de inscripciones antes de generar el fixture: el admin puede
-- reordenar las parejas/jugadores inscriptos mientras el torneo está 'open',
-- y ese orden es el que usa startTournamentAction para armar los cruces
-- (pareja 1 vs pareja 2, pareja 3 vs pareja 4, etc.) en vez de la fecha de
-- inscripción.

alter table public.tournament_registrations
  add column if not exists registration_order integer not null default 0;

create index if not exists tournament_registrations_order_idx
  on public.tournament_registrations (tournament_id, registration_order);
