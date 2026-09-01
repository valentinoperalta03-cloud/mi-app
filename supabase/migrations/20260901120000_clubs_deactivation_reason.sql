-- clubs.is_active es un unico boolean que hoy mezcla dos causas distintas:
-- 1) baja MANUAL del superadmin (deactivateClubAction/toggleClubActiveAction)
-- 2) baja AUTOMATICA por vencimiento de trial (cron expire-trials)
--
-- Sin distinguirlas, una reactivacion automatica (webhook de MP volviendo a
-- 'active') no puede saber si es seguro poner is_active=true de nuevo: si la
-- causa fue una baja manual del superadmin (ban operativo), un pago de MP no
-- debe revertirla solo. Ver lib/mp-handlers/subscription-webhook-handler.ts
-- y app/superadmin/actions.ts.
alter table public.clubs
  add column if not exists deactivation_reason text
  constraint clubs_deactivation_reason_check
  check (deactivation_reason is null or deactivation_reason in ('manual', 'subscription'));

-- Backfill: la unica causa automatica que existe hoy (expire-trials) es la
-- unica razon por la que algun club puede estar is_active=false en este
-- momento (confirmado por auditoria: 0 bajas manuales registradas todavia).
update public.clubs
set deactivation_reason = 'subscription'
where is_active = false and deactivation_reason is null;

comment on column public.clubs.deactivation_reason is
  'Causa de is_active=false: manual (baja del superadmin, nunca se auto-revierte) o subscription (cron expire-trials, se restaura automaticamente cuando la suscripcion vuelve a active).';
