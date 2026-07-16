-- Flujo de activacion de trial con tarjeta obligatoria: los clubes ya no
-- arrancan en 'trial' automaticamente. Arrancan en 'pending' y recien pasan
-- a 'trial' cuando MP confirma que la tarjeta quedo autorizada (preapproval
-- status=authorized), ver app/api/mp/subscriptions/webhook y
-- app/admin/facturacion/callback.

alter table public.clubs
  drop constraint if exists clubs_subscription_status_check;

alter table public.clubs
  add constraint clubs_subscription_status_check
  check (subscription_status in ('pending', 'trial', 'active', 'past_due', 'paused'));

-- Clubes existentes que nunca cargaron una tarjeta (trial "de regalo" del
-- modelo anterior) pasan a pending para completar el nuevo flujo de alta.
update public.clubs
set subscription_status = 'pending'
where subscription_status = 'trial'
  and mp_subscription_id is null;

-- Sin este default, todo club nuevo seguiria naciendo en 'trial' (el default
-- original de la migracion b2b_saas_subscriptions_deposits) y se saltearia
-- por completo el paso de cargar la tarjeta, que es el punto central de
-- este cambio.
alter table public.clubs
  alter column subscription_status set default 'pending';
