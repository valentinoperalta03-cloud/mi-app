-- Onboarding checklist: marcar club como completado para no volver a mostrar la guía en el panel.
alter table public.clubs
  add column if not exists onboarding_completed boolean not null default false;
