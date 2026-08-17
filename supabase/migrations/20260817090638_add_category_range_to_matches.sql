ALTER TABLE matches ADD COLUMN IF NOT EXISTS category_range text[] DEFAULT NULL;

COMMENT ON COLUMN matches.category_range IS
  'Rango de categorías permitidas para unirse al partido. NULL = sin restricción.';
