-- Campos nuevos del wizard de 4 pasos: partidos garantizados, notas libres de
-- organizacion (americano), fechas de instancias finales para torneos de
-- eliminacion multi-dia, y los slots de cancha bloqueados durante la
-- creacion (antes de que el torneo tenga id propio para court_blocks).
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS guaranteed_matches integer DEFAULT NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS tournament_notes text DEFAULT NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS quarterfinals_date date DEFAULT NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS semifinals_date date DEFAULT NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS finals_date date DEFAULT NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS matches_per_day integer DEFAULT NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS tournament_court_blocks jsonb DEFAULT NULL;
-- Guarda los slots bloqueados: [{date, courtId, time}]
