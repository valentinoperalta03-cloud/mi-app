-- court_blocks: quitar la policy permisiva que dejaba a CUALQUIER usuario
-- autenticado crear, editar y borrar bloqueos de canchas de cualquier club.
--
-- Estado previo (verificado en pg_policies):
--   Admin_Gestiona_Bloqueos   ALL    TO authenticated  USING (true)   WITH CHECK (null)
--   "Dueños gestionan sus bloqueos" ALL TO public      USING (owner)  WITH CHECK (null)
--   Ver_Bloqueos              SELECT TO public         USING (true)
--
-- En RLS las policies se combinan con OR, así que la permisiva anulaba a la de
-- dueños: con la sesión de un jugador cualquiera se podía bloquear o liberar
-- una cancha ajena vía la API de Supabase.
--
-- Writers verificados antes de quitarla:
--   - /admin/clases (createTrainingBlockAction, liberarHorarioPuntualAction,
--     deleteExternalTrainingBlockRowAction): cliente del usuario -> queda
--     cubierto por la policy de dueños, que ya valida court -> club -> owner_id.
--   - /admin/torneos (createTournament, assignTournamentMatchSlot): service
--     client, RLS no aplica.
--   - /api/cron/generate-training-blocks: service client, RLS no aplica.
--   - /admin/bloqueos (nuevo): cliente del usuario + validación de pertenencia
--     en la action -> cubierto por la policy de dueños.
--
-- Ver_Bloqueos NO se toca: getClubAvailability lee court_blocks con el cliente
-- anónimo para la página pública del club. Sin ese SELECT abierto, un visitante
-- sin sesión vería como libres los horarios bloqueados.

drop policy if exists "Admin_Gestiona_Bloqueos" on public.court_blocks;

-- Se recrea la policy de dueños con WITH CHECK explícito. Postgres usa la
-- expresión de USING también como check cuando WITH CHECK se omite, así que el
-- comportamiento no cambia: queda escrito para que no dependa de ese default.
drop policy if exists "Dueños gestionan sus bloqueos" on public.court_blocks;

create policy "Dueños gestionan sus bloqueos"
  on public.court_blocks for all
  to authenticated
  using (
    exists (
      select 1
      from public.courts
      join public.clubs on clubs.id = courts.club_id
      where courts.id = court_blocks.court_id
        and clubs.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.courts
      join public.clubs on clubs.id = courts.club_id
      where courts.id = court_blocks.court_id
        and clubs.owner_id = auth.uid()
    )
  );

-- Índice para las consultas de disponibilidad, que siempre filtran por
-- cancha + fecha (court_blocks_court_date_time_key solo cubre el trío completo
-- y exige blocked_time).
create index if not exists court_blocks_court_blocked_date_idx
  on public.court_blocks (court_id, blocked_date);
