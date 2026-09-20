-- Torneos V2 · Fase C · Motor competitivo (zonas → partidos → resultados →
-- clasificados → cuadro → avance automático → campeón)
--
-- No se aplicó en ningún ambiente remoto. Forward-only sobre todo lo que
-- dejaron 20260917*/20260918* — ninguna de esas se edita.

-- ---------------------------------------------------------------------------
-- Columnas nuevas
-- ---------------------------------------------------------------------------
-- Marca que la categoría ya clasificó (bloquea edición retroactiva de
-- resultados de zona que cambiarían quién clasifica, y habilita generar el
-- cuadro). Análoga a zones_generated_at (Fase B).
alter table public.tournament_categories add column if not exists qualifiers_generated_at timestamptz;

-- Puesto de siembra 1..N asignado al clasificar (NULL = no clasificó o el
-- formato no usa cuadro). Vive en la inscripción porque una pareja clasifica
-- una sola vez por categoría — coherente con la unicidad categoría↔jugador.
alter table public.tournament_registrations add column if not exists qualified_seed integer;
alter table public.tournament_registrations drop constraint if exists tournament_registrations_qualified_seed_check;
alter table public.tournament_registrations
  add constraint tournament_registrations_qualified_seed_check check (qualified_seed is null or qualified_seed >= 1);

-- ---------------------------------------------------------------------------
-- Integridad: un partido y su feeder no pueden mezclar categorías; un
-- partido de zona no puede enfrentar inscripciones de otra zona/categoría.
-- Solo se exige cuando category_id está seteado (todo lo que genera Fase C
-- lo setea siempre; filas legacy sin categoría no se ven afectadas).
-- ---------------------------------------------------------------------------
create or replace function public.tournament_matches_guard_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_p1_cat uuid; v_p1_zone uuid;
  v_p2_cat uuid; v_p2_zone uuid;
  v_fl_cat uuid; v_fr_cat uuid;
begin
  if new.pair1_id is not null and new.pair1_id = new.pair2_id then
    raise exception 'Un partido no puede enfrentar a una inscripción contra sí misma' using errcode = 'check_violation';
  end if;

  if new.category_id is null then
    return new;
  end if;

  if new.pair1_id is not null then
    select category_id, zone_id into v_p1_cat, v_p1_zone from public.tournament_registrations where id = new.pair1_id;
    if v_p1_cat is distinct from new.category_id then
      raise exception 'pair1_id no pertenece a la categoría del partido' using errcode = 'check_violation';
    end if;
    if new.phase = 'zone' and v_p1_zone is distinct from new.zone_id then
      raise exception 'pair1_id no pertenece a la zona del partido' using errcode = 'check_violation';
    end if;
  end if;

  if new.pair2_id is not null then
    select category_id, zone_id into v_p2_cat, v_p2_zone from public.tournament_registrations where id = new.pair2_id;
    if v_p2_cat is distinct from new.category_id then
      raise exception 'pair2_id no pertenece a la categoría del partido' using errcode = 'check_violation';
    end if;
    if new.phase = 'zone' and v_p2_zone is distinct from new.zone_id then
      raise exception 'pair2_id no pertenece a la zona del partido' using errcode = 'check_violation';
    end if;
  end if;

  if new.feeder_left_match_id is not null then
    select category_id into v_fl_cat from public.tournament_matches where id = new.feeder_left_match_id;
    if v_fl_cat is distinct from new.category_id then
      raise exception 'feeder_left_match_id pertenece a otra categoría' using errcode = 'check_violation';
    end if;
  end if;
  if new.feeder_right_match_id is not null then
    select category_id into v_fr_cat from public.tournament_matches where id = new.feeder_right_match_id;
    if v_fr_cat is distinct from new.category_id then
      raise exception 'feeder_right_match_id pertenece a otra categoría' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tournament_matches_guard_integrity on public.tournament_matches;
create trigger tournament_matches_guard_integrity
  before insert or update of category_id, zone_id, phase, pair1_id, pair2_id, feeder_left_match_id, feeder_right_match_id
  on public.tournament_matches
  for each row execute function public.tournament_matches_guard_integrity();

-- No duplicar el mismo enfrentamiento dentro de una zona (defensa extra:
-- generate_zone_matches ya es determinista y borra-antes-de-crear bajo lock).
create unique index if not exists tournament_matches_zone_unique_matchup
  on public.tournament_matches (zone_id, least(pair1_id::text, pair2_id::text), greatest(pair1_id::text, pair2_id::text))
  where phase = 'zone' and pair1_id is not null and pair2_id is not null;

-- ---------------------------------------------------------------------------
-- RPC 1: generar los partidos round-robin de cada zona de una categoría.
-- ---------------------------------------------------------------------------
-- Regenerar es seguro mientras ningún partido de zona esté 'finished' (borra
-- y recrea bajo el lock de la categoría, igual que tournament_generate_zones
-- de Fase B). Si ya hay resultados cargados, se bloquea.
create or replace function public.tournament_generate_zone_matches(p_category_id uuid)
returns table (ok boolean, reason text, matches_created integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat public.tournament_categories%rowtype;
  v_t public.tournaments%rowtype;
  v_zone record;
  v_members uuid[];
  v_created int := 0;
  v_i int;
  v_n int;
begin
  select * into v_cat from public.tournament_categories where id = p_category_id for update;
  if not found then
    return query select false, 'category_not_found'::text, 0; return;
  end if;
  select * into v_t from public.tournaments where id = v_cat.tournament_id;

  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or not exists (select 1 from public.clubs c where c.id = v_t.club_id and c.owner_id = auth.uid()) then
      return query select false, 'forbidden'::text, 0; return;
    end if;
  end if;

  if not exists (select 1 from public.tournament_zones where category_id = p_category_id) then
    return query select false, 'no_zones'::text, 0; return;
  end if;

  if exists (select 1 from public.tournament_matches where category_id = p_category_id and phase = 'zone' and status = 'finished') then
    return query select false, 'zone_matches_started'::text, 0; return;
  end if;

  delete from public.tournament_matches where category_id = p_category_id and phase = 'zone';

  for v_zone in select * from public.tournament_zones where category_id = p_category_id order by sort_order loop
    v_members := array(
      select r.id from public.tournament_registrations r
      where r.zone_id = v_zone.id and r.category_id = p_category_id
      order by r.registered_at
    );
    v_n := coalesce(array_length(v_members, 1), 0);
    for v_i in 1 .. v_n loop
      for v_j in (v_i + 1) .. v_n loop
        insert into public.tournament_matches (tournament_id, category_id, zone_id, phase, round, pair1_id, pair2_id, status)
        values (v_cat.tournament_id, p_category_id, v_zone.id, 'zone', 1, v_members[v_i], v_members[v_j], 'pending');
        v_created := v_created + 1;
      end loop;
    end loop;
  end loop;

  return query select true, 'ok'::text, v_created;
end;
$$;

revoke all on function public.tournament_generate_zone_matches(uuid) from public, anon;
grant execute on function public.tournament_generate_zone_matches(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC 2: cargar/corregir el resultado de un partido (zona o cuadro).
-- ---------------------------------------------------------------------------
-- La validación deportiva (sets/games/empate/desempate según el formato)
-- corre en TypeScript (lib/tournament/v2/results.ts validateMatchResult)
-- ANTES de llamar acá — esta función recibe el resultado ya normalizado y
-- se encarga de la parte que solo la base puede garantizar de forma segura:
--   - lock del partido;
--   - ownership;
--   - si el partido YA estaba terminado y el ganador CAMBIA:
--       zona: bloqueado si la categoría ya generó clasificados
--             (qualifiers_generated_at) — cambiar standings después de
--             armar el cuadro podría dejar afuera a quien ya clasificó;
--       cuadro: bloqueado si el partido que alimenta (feeder) ya está
--             'in_progress' o 'finished' — no se puede corregir un cruce
--             cuyo ganador ya empezó a jugar la siguiente ronda;
--   - persistencia atómica con result_version para concurrencia.
-- El avance de ganador en el cuadro (propagateBracket) NO vive acá: se
-- reutiliza tal cual desde TypeScript después de que esta función confirma
-- que el cambio está permitido — ver "reutilizar tournament-match-result.ts".
create or replace function public.tournament_apply_match_result_v2(
  p_match_id uuid,
  p_outcome text,
  p_sets1 integer,
  p_sets2 integer,
  p_games1 integer,
  p_games2 integer,
  p_sets_json jsonb,
  p_tiebreak_winner smallint
)
returns table (ok boolean, reason text, winner_pair_id uuid, phase text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.tournament_matches%rowtype;
  v_t public.tournaments%rowtype;
  v_cat public.tournament_categories%rowtype;
  v_winner uuid;
begin
  select * into v_m from public.tournament_matches where id = p_match_id for update;
  if not found then
    return query select false, 'match_not_found'::text, null::uuid, null::text; return;
  end if;
  select * into v_t from public.tournaments where id = v_m.tournament_id;

  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or not exists (select 1 from public.clubs c where c.id = v_t.club_id and c.owner_id = auth.uid()) then
      return query select false, 'forbidden'::text, null::uuid, v_m.phase; return;
    end if;
  end if;

  if v_m.pair1_id is null or v_m.pair2_id is null then
    return query select false, 'missing_pairs'::text, null::uuid, v_m.phase; return;
  end if;
  if p_outcome not in ('pair1', 'pair2', 'draw') then
    return query select false, 'invalid_outcome'::text, null::uuid, v_m.phase; return;
  end if;
  -- Defensa en profundidad: zonas y americano admiten empate (phaseAllowsDraw
  -- en TypeScript), knockout/americano_final/pena nunca. La app ya lo valida
  -- antes de llamar acá; esto evita que cualquier otro caller lo salte.
  if p_outcome = 'draw' and v_m.phase not in ('zone', 'americano') then
    return query select false, 'draw_not_allowed'::text, null::uuid, v_m.phase; return;
  end if;

  v_winner := case p_outcome when 'pair1' then v_m.pair1_id when 'pair2' then v_m.pair2_id else null end;

  if v_m.status = 'finished' and v_m.winner_pair_id is distinct from v_winner then
    if v_m.phase = 'zone' then
      select * into v_cat from public.tournament_categories where id = v_m.category_id;
      if v_cat.qualifiers_generated_at is not null then
        return query select false, 'qualifiers_already_generated'::text, null::uuid, v_m.phase; return;
      end if;
    else
      if exists (
        select 1 from public.tournament_matches c
        where (c.feeder_left_match_id = p_match_id or c.feeder_right_match_id = p_match_id)
          and c.status <> 'pending'
      ) then
        return query select false, 'next_round_started'::text, null::uuid, v_m.phase; return;
      end if;
    end if;
  end if;

  update public.tournament_matches
  set pair1_score = p_sets1,
      pair2_score = p_sets2,
      pair1_games = p_games1,
      pair2_games = p_games2,
      sets = coalesce(p_sets_json, '[]'::jsonb),
      is_draw = (p_outcome = 'draw'),
      tiebreak_winner = p_tiebreak_winner,
      winner_pair_id = v_winner,
      status = 'finished',
      result_version = coalesce(result_version, 0) + 1
  where id = p_match_id;

  return query select true, 'ok'::text, v_winner, v_m.phase;
end;
$$;

revoke all on function public.tournament_apply_match_result_v2(uuid, text, integer, integer, integer, integer, jsonb, smallint) from public, anon;
grant execute on function public.tournament_apply_match_result_v2(uuid, text, integer, integer, integer, integer, jsonb, smallint) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC 3: persistir los clasificados (seeds 1..N) de una categoría, ya
-- resueltos en TypeScript (selectQualifiers) a partir de los standings.
-- ---------------------------------------------------------------------------
create or replace function public.tournament_set_qualifiers(p_category_id uuid, p_seeds jsonb)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat public.tournament_categories%rowtype;
  v_t public.tournaments%rowtype;
  v_item jsonb;
  v_invalid int;
begin
  select * into v_cat from public.tournament_categories where id = p_category_id for update;
  if not found then
    return query select false, 'category_not_found'::text; return;
  end if;
  select * into v_t from public.tournaments where id = v_cat.tournament_id;

  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or not exists (select 1 from public.clubs c where c.id = v_t.club_id and c.owner_id = auth.uid()) then
      return query select false, 'forbidden'::text; return;
    end if;
  end if;

  -- No se puede reclasificar si el cuadro ya existe: primero habría que
  -- borrarlo explícitamente (tournament_persist_bracket ya lo protege si
  -- tiene resultados).
  if exists (select 1 from public.tournament_matches where category_id = p_category_id and phase = 'knockout') then
    return query select false, 'bracket_already_exists'::text; return;
  end if;

  select count(*) into v_invalid
  from jsonb_array_elements(p_seeds) e
  where not exists (
    select 1 from public.tournament_registrations r
    where r.id = (e ->> 'registrationId')::uuid and r.category_id = p_category_id
  );
  if v_invalid > 0 then
    return query select false, 'invalid_registration'::text; return;
  end if;

  update public.tournament_registrations set qualified_seed = null where category_id = p_category_id;
  for v_item in select * from jsonb_array_elements(p_seeds) loop
    update public.tournament_registrations
    set qualified_seed = (v_item ->> 'seed')::int
    where id = (v_item ->> 'registrationId')::uuid;
  end loop;

  update public.tournament_categories set qualifiers_generated_at = now() where id = p_category_id;
  return query select true, 'ok'::text;
end;
$$;

revoke all on function public.tournament_set_qualifiers(uuid, jsonb) from public, anon;
grant execute on function public.tournament_set_qualifiers(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC 4: persistir el cuadro eliminatorio (ya armado en TypeScript por
-- buildSeededEliminationFixture a partir de los clasificados sembrados).
-- ---------------------------------------------------------------------------
create or replace function public.tournament_persist_bracket(p_category_id uuid, p_matches jsonb)
returns table (ok boolean, reason text, matches_created integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat public.tournament_categories%rowtype;
  v_t public.tournaments%rowtype;
  v_row jsonb;
  v_created int := 0;
begin
  select * into v_cat from public.tournament_categories where id = p_category_id for update;
  if not found then
    return query select false, 'category_not_found'::text, 0; return;
  end if;
  select * into v_t from public.tournaments where id = v_cat.tournament_id;

  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or not exists (select 1 from public.clubs c where c.id = v_t.club_id and c.owner_id = auth.uid()) then
      return query select false, 'forbidden'::text, 0; return;
    end if;
  end if;

  if v_cat.qualifiers_generated_at is null then
    return query select false, 'qualifiers_not_generated'::text, 0; return;
  end if;

  if exists (select 1 from public.tournament_matches where category_id = p_category_id and phase = 'knockout' and status <> 'pending') then
    return query select false, 'bracket_started'::text, 0; return;
  end if;

  delete from public.tournament_matches where category_id = p_category_id and phase = 'knockout';

  for v_row in select * from jsonb_array_elements(p_matches) loop
    insert into public.tournament_matches (
      id, tournament_id, category_id, phase, round, round_name, bracket_slot,
      pair1_id, pair2_id, feeder_left_match_id, feeder_right_match_id, status
    ) values (
      (v_row ->> 'id')::uuid, v_cat.tournament_id, p_category_id, 'knockout',
      (v_row ->> 'round')::int, v_row ->> 'roundName', (v_row ->> 'slot')::int,
      (v_row ->> 'pair1Id')::uuid, (v_row ->> 'pair2Id')::uuid,
      (v_row ->> 'feederLeftMatchId')::uuid, (v_row ->> 'feederRightMatchId')::uuid,
      'pending'
    );
    v_created := v_created + 1;
  end loop;

  return query select true, 'ok'::text, v_created;
end;
$$;

revoke all on function public.tournament_persist_bracket(uuid, jsonb) from public, anon;
grant execute on function public.tournament_persist_bracket(uuid, jsonb) to authenticated, service_role;
