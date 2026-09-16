-- Motivo opcional de un bloqueo manual (/admin/bloqueos).
--
-- court_blocks.reason sigue siendo el discriminador tecnico (bloqueo_manual,
-- entrenamiento_externo, torneo) y todas las queries filtran por igualdad exacta
-- sobre el; el texto libre que escribe el dueno va en esta columna aparte.
-- Solo aditiva: nullable, sin default, sin backfill. La tabla tiene grants a
-- nivel de tabla, asi que la columna los hereda; RLS no cambia.
alter table public.court_blocks
  add column if not exists note text;
