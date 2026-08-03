-- Rediseño de turnos fijos: cada turno ahora tiene un título propio
-- (ej. "Peralta", "Los jueves de Marcos") y puede existir sin jugadores
-- asignados todavía, ya que la asignación de jugadores pasa a ser opcional.
ALTER TABLE fixed_slots
  ADD COLUMN IF NOT EXISTS title text;
