-- subscription_status esta revocado para authenticated/anon en clubs; esta funcion
-- expone unicamente el booleano de disponibilidad para que el jugador vea el badge
-- "No disponible" sin poder leer el status crudo.
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
    (COALESCE(subscription_status, 'trial') IN ('trial', 'active')) as is_available
  FROM clubs
  WHERE is_active = true;
$$;

GRANT EXECUTE ON FUNCTION get_clubs_availability() TO authenticated, anon;
