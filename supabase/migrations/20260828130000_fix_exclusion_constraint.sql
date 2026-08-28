-- El constraint actual bloquea INSERT de matches aunque el conflicto
-- sea con un match cancelado. Hay que recrearlo excluyendo cancelados,
-- para que el generador de turnos fijos pueda regenerar un match en un
-- horario donde el match anterior ya fue cancelado.

ALTER TABLE matches DROP CONSTRAINT IF EXISTS sin_partidos_superpuestos;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE matches ADD CONSTRAINT sin_partidos_superpuestos
EXCLUDE USING gist (
  court_id WITH =,
  tsrange(date, date + interval '90 minutes') WITH &&
)
WHERE (match_status != 'cancelled');
