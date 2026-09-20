-- ---------------------------------------------------------------------------
-- Desempate absoluto configurable (sección 25.2 del prompt maestro de
-- torneos): cuando dos o más parejas quedan igualadas en TODOS los criterios
-- de clasificación (selectQualifiers ya lo detecta y lo reporta como
-- PendingTiebreak), el club resuelve con una de dos vías:
--
--   A) Partido de desempate: se juega un tournament_matches con
--      phase='tiebreak' (agregado acá al CHECK existente) y se carga su
--      resultado con la misma tournament_apply_match_result_v2 de siempre.
--      selectQualifiers lee el partido terminado directamente (ver
--      previewQualifiersAction en competitive-actions.ts) — no hace falta
--      persistir nada extra para esta vía.
--
--   B) Resolución administrativa: no hay partido de por medio, así que la
--      decisión (quién gana la plaza y por qué) se persiste en
--      tournament_tiebreak_resolutions para que quede registrada y sea
--      reproducible entre llamadas a previewQualifiersAction.
--
-- Ninguna de las dos vías inventa un orden: selectQualifiers (Fase A) exige
-- que la resolución cubra exactamente el mismo grupo de parejas empatadas
-- que reportó, si no, el empate sigue pendiente.
-- ---------------------------------------------------------------------------

alter table public.tournament_matches drop constraint if exists tournament_matches_phase_check;
alter table public.tournament_matches
  add constraint tournament_matches_phase_check
  check (phase is null or phase in ('americano', 'americano_final', 'zone', 'knockout', 'pena', 'tiebreak'));

create table if not exists public.tournament_tiebreak_resolutions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.tournament_categories(id) on delete cascade,
  -- Grupo empatado (sin orden) tal como lo reporta PendingTiebreak.pairIds.
  pair_ids uuid[] not null,
  -- Prioridad decidida, de mejor a peor. Debe ser una permutación de pair_ids.
  winner_order uuid[] not null,
  reason text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists tournament_tiebreak_resolutions_category_idx
  on public.tournament_tiebreak_resolutions(category_id);

alter table public.tournament_tiebreak_resolutions enable row level security;

create policy tournament_tiebreak_resolutions_select_public
  on public.tournament_tiebreak_resolutions for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.tournament_tiebreak_resolutions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: registrar una resolución administrativa. No permite reclasificar si
-- el cuadro ya existe (mismo resguardo que tournament_set_qualifiers).
-- ---------------------------------------------------------------------------
create or replace function public.tournament_record_tiebreak_resolution(
  p_category_id uuid,
  p_pair_ids uuid[],
  p_winner_order uuid[],
  p_reason text
)
returns table (ok boolean, reason text, resolution_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat public.tournament_categories%rowtype;
  v_t public.tournaments%rowtype;
  v_id uuid;
  v_invalid int;
begin
  select * into v_cat from public.tournament_categories where id = p_category_id for update;
  if not found then
    return query select false, 'category_not_found'::text, null::uuid; return;
  end if;
  select * into v_t from public.tournaments where id = v_cat.tournament_id;

  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or not exists (select 1 from public.clubs c where c.id = v_t.club_id and c.owner_id = auth.uid()) then
      return query select false, 'forbidden'::text, null::uuid; return;
    end if;
  end if;

  if exists (select 1 from public.tournament_matches where category_id = p_category_id and phase = 'knockout') then
    return query select false, 'bracket_already_exists'::text, null::uuid; return;
  end if;

  if array_length(p_pair_ids, 1) is null or array_length(p_pair_ids, 1) < 2
     or array_length(p_winner_order, 1) is distinct from array_length(p_pair_ids, 1) then
    return query select false, 'invalid_input'::text, null::uuid; return;
  end if;

  select count(*) into v_invalid
  from unnest(p_pair_ids) pid
  where pid not in (select unnest(p_winner_order));
  if v_invalid > 0 then
    return query select false, 'invalid_input'::text, null::uuid; return;
  end if;

  select count(*) into v_invalid
  from unnest(p_pair_ids) pid
  where not exists (select 1 from public.tournament_registrations r where r.id = pid and r.category_id = p_category_id);
  if v_invalid > 0 then
    return query select false, 'invalid_registration'::text, null::uuid; return;
  end if;

  if trim(coalesce(p_reason, '')) = '' then
    return query select false, 'reason_required'::text, null::uuid; return;
  end if;

  insert into public.tournament_tiebreak_resolutions (category_id, pair_ids, winner_order, reason, created_by)
  values (p_category_id, p_pair_ids, p_winner_order, trim(p_reason), case when coalesce(auth.role(), '') = 'service_role' then null else auth.uid() end)
  returning id into v_id;

  return query select true, 'ok'::text, v_id;
end;
$$;

revoke all on function public.tournament_record_tiebreak_resolution(uuid, uuid[], uuid[], text) from public, anon;
grant execute on function public.tournament_record_tiebreak_resolution(uuid, uuid[], uuid[], text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: crear el partido de desempate (vía A). Se programa como cualquier
-- otro tournament_matches (tournament_assign_match_slot) y se carga su
-- resultado como cualquier otro (tournament_apply_match_result_v2); acá solo
-- se crea la fila.
-- ---------------------------------------------------------------------------
create or replace function public.tournament_create_tiebreak_match(
  p_category_id uuid,
  p_zone_id uuid,
  p_pair1_id uuid,
  p_pair2_id uuid
)
returns table (ok boolean, reason text, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat public.tournament_categories%rowtype;
  v_t public.tournaments%rowtype;
  v_id uuid;
begin
  select * into v_cat from public.tournament_categories where id = p_category_id for update;
  if not found then
    return query select false, 'category_not_found'::text, null::uuid; return;
  end if;
  select * into v_t from public.tournaments where id = v_cat.tournament_id;

  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or not exists (select 1 from public.clubs c where c.id = v_t.club_id and c.owner_id = auth.uid()) then
      return query select false, 'forbidden'::text, null::uuid; return;
    end if;
  end if;

  if exists (select 1 from public.tournament_matches where category_id = p_category_id and phase = 'knockout') then
    return query select false, 'bracket_already_exists'::text, null::uuid; return;
  end if;

  if not exists (select 1 from public.tournament_registrations r where r.id = p_pair1_id and r.category_id = p_category_id)
     or not exists (select 1 from public.tournament_registrations r where r.id = p_pair2_id and r.category_id = p_category_id) then
    return query select false, 'invalid_registration'::text, null::uuid; return;
  end if;

  insert into public.tournament_matches (
    tournament_id, category_id, zone_id, phase, round, round_name, pair1_id, pair2_id, status
  ) values (
    v_cat.tournament_id, p_category_id, p_zone_id, 'tiebreak', 0, 'Desempate', p_pair1_id, p_pair2_id, 'pending'
  )
  returning id into v_id;

  return query select true, 'ok'::text, v_id;
end;
$$;

revoke all on function public.tournament_create_tiebreak_match(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.tournament_create_tiebreak_match(uuid, uuid, uuid, uuid) to authenticated, service_role;
