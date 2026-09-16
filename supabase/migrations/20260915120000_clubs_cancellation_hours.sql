-- clubs.cancellation_hours ya existe en produccion pero nunca se versiono en
-- migrations (se agrego fuera del repo). Esta migracion la formaliza de forma
-- idempotente y deja los grants alineados con el resto de columnas publicas
-- del club: la pagina publica /[slug] necesita leerla como anon.
alter table public.clubs
  add column if not exists cancellation_hours integer;

grant select (cancellation_hours) on public.clubs to anon, authenticated;
grant insert (cancellation_hours) on public.clubs to anon, authenticated;
grant update (cancellation_hours) on public.clubs to anon, authenticated;

-- Backfill conservador: solo clubes cuyo texto de politica coincide EXACTAMENTE
-- con el `policy` de un preset (lib/admin/cancellation-policy-presets.ts). El
-- texto libre no se interpreta: un club con politica escrita a mano queda en
-- NULL y cae al default de resolveCancellationHours (24), sin adivinar.
update public.clubs set cancellation_hours = 0
  where cancellation_hours is null and cancellation_policy = 'Sin reembolso';
update public.clubs set cancellation_hours = 2
  where cancellation_hours is null and cancellation_policy = 'Reembolso hasta 2 horas antes del turno';
update public.clubs set cancellation_hours = 6
  where cancellation_hours is null and cancellation_policy = 'Reembolso hasta 6 horas antes del turno';
update public.clubs set cancellation_hours = 12
  where cancellation_hours is null and cancellation_policy = 'Reembolso hasta 12 horas antes del turno';
update public.clubs set cancellation_hours = 24
  where cancellation_hours is null and cancellation_policy = 'Reembolso hasta 24 horas antes del turno';
update public.clubs set cancellation_hours = 48
  where cancellation_hours is null and cancellation_policy = 'Reembolso hasta 48 horas antes del turno';
