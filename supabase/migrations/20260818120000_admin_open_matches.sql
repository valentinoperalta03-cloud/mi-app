-- Partidos abiertos creados desde el panel admin del club + jugadores
-- invitados por el club sin cuenta en la app.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS created_by_club boolean DEFAULT false;

ALTER TABLE match_participants ALTER COLUMN player_id DROP NOT NULL;
ALTER TABLE match_participants ADD COLUMN IF NOT EXISTS guest_name text DEFAULT NULL;
ALTER TABLE match_participants ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

COMMENT ON COLUMN matches.created_by_club IS
  'true si el partido fue creado desde el panel admin del club';
COMMENT ON COLUMN match_participants.guest_name IS
  'Nombre del jugador cuando fue agregado por el club sin cuenta en la app (player_id queda NULL)';
