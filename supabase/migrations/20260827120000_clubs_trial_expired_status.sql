-- El cron /api/cron/expire-trials pasa clubes con trial vencido a
-- subscription_status = 'trial_expired'. Sumar el valor al check constraint
-- existente (ver 20260716130000_clubs_subscription_pending_state.sql).
alter table public.clubs
  drop constraint if exists clubs_subscription_status_check;

alter table public.clubs
  add constraint clubs_subscription_status_check
  check (subscription_status in ('pending', 'trial', 'active', 'past_due', 'paused', 'trial_expired'));

-- get_clubs_availability trataba cualquier club en 'trial' como disponible,
-- sin mirar trial_end_date, asi que un trial vencido (antes de que el cron
-- corra, o si el cron falla) seguia visible para jugadores.
CREATE OR REPLACE FUNCTION get_clubs_availability()
RETURNS TABLE (
  club_id uuid,
  is_available boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id as club_id,
    (
      subscription_status = 'active'
      OR (COALESCE(subscription_status, 'trial') = 'trial' AND trial_end_date > NOW())
    ) as is_available
  FROM clubs
  WHERE is_active = true;
$$;

GRANT EXECUTE ON FUNCTION get_clubs_availability() TO authenticated, anon;
