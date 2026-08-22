-- Categorías permitidas por torneo (post-ELO): reemplaza el filtrado numérico
-- legacy category_min/category_max por un array de strings que matchean
-- directamente profiles.category ("8va".."1ra"). category_min/category_max
-- no se dropean todavía porque el detalle del torneo (app/admin/torneos/[id])
-- sigue leyéndolos — quedan como legacy hasta que se migren esas lecturas.
alter table public.tournaments
  add column if not exists allowed_categories text[];
