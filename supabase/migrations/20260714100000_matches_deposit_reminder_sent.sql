-- Flag de idempotencia para el aviso "te quedan 5 minutos para pagar la sena"
-- del cron expire-unpaid-matches (evita reenviarlo en cada corrida del cron
-- mientras el partido esta en la ventana de 10-15 minutos).
alter table public.matches
  add column if not exists deposit_reminder_sent boolean not null default false;
