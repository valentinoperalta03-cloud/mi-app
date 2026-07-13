-- El webhook de suscripciones busca el club por mp_subscription_id (id de la
-- preapproval en MP) para notificaciones de pago recurrente (authorized_payment)
-- que no llevan external_reference propio.
create index if not exists clubs_mp_subscription_id_idx
  on public.clubs (mp_subscription_id);
