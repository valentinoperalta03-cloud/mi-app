-- Un club en pending (todavia no activo su suscripcion) no debe listarse para
-- jugadores. Un club en trial/active pero sin onboarding completo o sin MP
-- conectado debe listarse pero marcado "No disponible" (is_available = false).
CREATE OR REPLACE FUNCTION get_clubs_availability()
RETURNS TABLE (club_id uuid, is_available boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id as club_id,
    (
      subscription_status IN ('trial', 'active')
      AND onboarding_completed = true
      AND mp_access_token IS NOT NULL
    ) as is_available
  FROM clubs
  WHERE is_active = true
  AND subscription_status IN ('trial', 'active', 'past_due', 'paused');
$$;

GRANT EXECUTE ON FUNCTION get_clubs_availability() TO authenticated, anon;
