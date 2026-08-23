-- Premios configurables por puesto y telefono de contacto para consultas.
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prizes jsonb DEFAULT NULL;
-- Estructura: [{ position: 1, description: "Copa + Medalla" }, ...]

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS contact_phone text DEFAULT NULL;
