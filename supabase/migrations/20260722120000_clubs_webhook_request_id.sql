-- Idempotencia del webhook de suscripciones: guarda el ultimo x-request-id de
-- MP procesado por club para descartar reintentos/entregas duplicadas.
alter table clubs
  add column if not exists last_webhook_request_id text;
