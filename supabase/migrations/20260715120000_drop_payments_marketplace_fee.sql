-- payments.marketplace_fee es del modelo de comisiones descontinuado. Ningun
-- archivo .ts/.tsx escribe un valor distinto de 0 ni lo lee; se elimina.
alter table public.payments
  drop column if exists marketplace_fee;
