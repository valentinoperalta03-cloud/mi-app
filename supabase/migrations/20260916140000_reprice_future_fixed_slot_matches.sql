-- Reparación de precios de ocurrencias futuras de turnos fijos.
--
-- lib/fixed-slot-generator.ts generaba cada ocurrencia con courts.price en vez
-- del precio efectivo del turno. Auditoría 2026-09-16: 94 matches futuros
-- activos (global-padel), todos sin dinero registrado, con total_price 66000
-- donde el precio efectivo es 76000 (diferencia +940000).
--
-- El precio efectivo se recalcula con la misma cadena que lib/court-pricing.ts
-- (resolvePriceFromPricing):
--   1. court_schedules del día de semana (extract(dow): 0 = domingo, igual que
--      Date#getDay) con start_time exacto
--   2. court_schedules legacy (day_of_week IS NULL) con start_time exacto
--   3. courts.price
--
-- Solo toca filas que al momento de ejecutarse siguen siendo seguras: turno
-- fijo, no cancelado, fecha de hoy en adelante (Argentina), sin cobro
-- (amount_paid = 0, financial_status 'unpaid') y sin payments aprobados.
-- Actualiza únicamente total_price y amount_pending (= total, porque no hay
-- nada abonado). No toca amount_paid, payment_status, payments, confirmed_at,
-- match_status ni late_cancellation_at.
--
-- Idempotente: una fila ya correcta no cumple `total_price is distinct from
-- precio efectivo`, así que una segunda corrida actualiza 0 filas.

with effective as (
  select
    m.id,
    round(coalesce(
      (select cs.price_override
         from public.court_schedules cs
        where cs.court_id = m.court_id
          and cs.day_of_week = extract(dow from m.scheduled_date)
          and cs.start_time = m.scheduled_time
          and cs.price_override is not null
        limit 1),
      (select cs.price_override
         from public.court_schedules cs
        where cs.court_id = m.court_id
          and cs.day_of_week is null
          and cs.start_time = m.scheduled_time
          and cs.price_override is not null
        limit 1),
      co.price
    ))::integer as effective_price
  from public.matches m
  join public.courts co on co.id = m.court_id
  where m.es_turno_fijo = true
    and coalesce(m.match_status, '') <> 'cancelled'
    and (m.scheduled_date + m.scheduled_time)
    > (now() at time zone 'America/Argentina/Buenos_Aires')
    and m.scheduled_time is not null
    and m.amount_paid = 0
    and m.financial_status = 'unpaid'
    and not exists (
      select 1 from public.payments p
       where p.match_id = m.id
         and p.status = 'approved'
    )
)
update public.matches m
   set total_price = e.effective_price,
       amount_pending = e.effective_price
  from effective e
 where m.id = e.id
   and e.effective_price is not null
   and m.total_price is distinct from e.effective_price;
