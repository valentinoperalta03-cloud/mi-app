CREATE TABLE IF NOT EXISTS match_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  tags text[] DEFAULT '{}',
  message text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(match_id, user_id)
);

ALTER TABLE match_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jugador puede ver su propio feedback"
  ON match_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "jugador puede insertar su propio feedback"
  ON match_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Superadmin y club owner pueden ver el feedback
CREATE POLICY "service role puede ver todo"
  ON match_feedback FOR SELECT
  USING (auth.role() = 'service_role');
