-- Copa de Plata (consolation bracket) para torneos de eliminacion directa.
-- Agrega columnas faltantes detectadas en la auditoria del modulo (scheduled_date,
-- notes, fixture_locked ya se leian/escribian en el codigo sin existir en el schema)
-- y suma soporte para una segunda llave (silver) alimentada por los perdedores
-- de la ronda 1 de la llave principal (gold).

-- Columnas faltantes en tournament_matches
ALTER TABLE tournament_matches
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS bracket TEXT DEFAULT 'gold'
    CHECK (bracket IN ('gold', 'silver'));

-- Columnas faltantes en tournaments
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS fixture_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS consolation_bracket BOOLEAN DEFAULT false;

-- Eliminar grupos_eliminacion del tipo de torneo (nunca tuvo generador de fixture
-- implementado; confirmado 0 filas con este tipo antes de aplicar el constraint)
ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_tournament_type_check;
ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_tournament_type_check
  CHECK (tournament_type IN ('americano', 'eliminacion', 'mixing'));
