-- Teléfono de WhatsApp del jugador, pedido en el nuevo onboarding para que
-- los clubes puedan contactarlo por sus reservas.

alter table public.profiles
  add column if not exists phone text;
