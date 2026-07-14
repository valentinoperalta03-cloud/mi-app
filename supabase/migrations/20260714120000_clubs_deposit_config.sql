-- La sena pasa de configurarse cancha por cancha (courts.requires_deposit/
-- deposit_type/deposit_value) a una configuracion global por club. Las
-- columnas de courts quedan deprecadas (no se borran, se dejan de usar).
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS deposit_type TEXT
    CHECK (deposit_type IN ('percentage', 'fixed')),
  ADD COLUMN IF NOT EXISTS deposit_value NUMERIC NOT NULL DEFAULT 0;
