-- Reservas manuales creadas por el club desde /admin/reservas: guarda el
-- nombre/referencia libre cuando no hay jugador de PadeLibre asignado como
-- owner (ej. "Reserva de Marcos por telefono").
alter table public.matches
  add column if not exists manual_reference text;
