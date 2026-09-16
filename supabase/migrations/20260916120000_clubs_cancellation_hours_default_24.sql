-- clubs.cancellation_hours NULL se interpretaba como 0 ("Sin reembolso") en
-- resolveCancellationHours (Number(null) === 0). El fallback contractual es 24:
-- se normalizan los clubes legacy en NULL y la columna pasa a DEFAULT 24, que
-- coincide con DEFAULT_CANCELLATION_HOURS (lib/cancellation-policy.ts).
--
-- NOT NULL queda fuera a propósito: la columna tiene grants de insert/update
-- para authenticated y no todos los writers históricos están auditados.
-- saveCancellationPolicy ya no escribe NULL; con el default y el resolver
-- corregido, un NULL residual vuelve a significar 24 en todas las capas.
--
-- Idempotente: re-ejecutarla no cambia nada.

alter table public.clubs
  alter column cancellation_hours set default 24;

update public.clubs
  set cancellation_hours = 24
  where cancellation_hours is null;
