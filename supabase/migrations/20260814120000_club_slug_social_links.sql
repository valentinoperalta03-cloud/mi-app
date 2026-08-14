-- Agregar columnas nuevas a clubs
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS slug text UNIQUE,
ADD COLUMN IF NOT EXISTS services text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS instagram text,
ADD COLUMN IF NOT EXISTS whatsapp text,
ADD COLUMN IF NOT EXISTS facebook text,
ADD COLUMN IF NOT EXISTS tiktok text;

-- Generar slugs automáticos para clubes existentes
UPDATE clubs
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      TRANSLATE(name, 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'),
      '[^a-zA-Z0-9\s]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL;

-- Redirect table para slugs viejos
CREATE TABLE IF NOT EXISTS club_slug_redirects (
  old_slug text PRIMARY KEY,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
