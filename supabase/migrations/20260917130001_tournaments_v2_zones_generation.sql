-- Torneos V2 · Fase B · Generación de zonas por categoría
--
-- No se aplicó en ningún ambiente remoto. Migración forward-only sobre lo que
-- dejó Fase A (20260917100000/100100/100200) — no se edita ninguna de esas.

-- ---------------------------------------------------------------------------
-- tournament_categories: marca de generación
-- ---------------------------------------------------------------------------
alter table public.tournament_categories add column if not exists zones_generated_at timestamptz;

-- ---------------------------------------------------------------------------
-- Integridad: la zona de una inscripción tiene que ser de SU MISMA categoría.
-- Sin esto, nada impedía asignar zone_id de la categoría B a una inscripción
-- de la categoría A (dos categorías del mismo torneo comparten tournament_id
-- pero tienen que administrar zonas completamente separadas).
-- ---------------------------------------------------------------------------
create or replace function public.tournament_registrations_guard_zone_category()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_zone_category uuid;
begin
  if new.zone_id is null then
    return new;
  end if;
  select category_id into v_zone_category from public.tournament_zones where id = new.zone_id;
  if v_zone_category is null then
    raise exception 'zone_id inválido' using errcode = 'foreign_key_violation';
  end if;
  if new.category_id is distinct from v_zone_category then
    raise exception 'La zona no pertenece a la categoría de la inscripción' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists tournament_registrations_guard_zone_category on public.tournament_registrations;
create trigger tournament_registrations_guard_zone_category
  before insert or update of zone_id, category_id on public.tournament_registrations
  for each row execute function public.tournament_registrations_guard_zone_category();

-- ---------------------------------------------------------------------------
-- RPC: generación atómica de zonas de una categoría
-- ---------------------------------------------------------------------------
-- Reparte las inscripciones ELEGIBLES de la categoría en p_zone_count zonas,
-- lo más parejo posible (mismo algoritmo que lib/tournament/v2/zones.ts
-- distributeZones: zonas más grandes primero, diferencia máxima 1).
--
-- Elegibilidad (decisión explícita, sección 4 del pedido de Fase B):
--   - payment_status = 'approved' únicamente. 'pending' (efectivo/transferencia
--     sin cobrar todavía) y 'pending_payment' (reserva de MP, puede vencer) NO
--     entran: una zona es una colocación competitiva, y una inscripción que
--     todavía puede caerse (por falta de cobro o por vencimiento) no está
--     lista para eso. 'expired'/'cancelled'/'refunded' tampoco, por construcción
--     (no cumplen payment_status='approved').
--   - waitlist = false.
--   - pareja completa: is_individual del torneo, o player2_id no nulo. Esto es
--     además una garantía estructural: "busco compañero" sin pareja formada
--     vive únicamente en tournament_partner_requests (nunca crea una fila en
--     tournament_registrations hasta que la pareja se completa), así que no
--     hay ningún caso real de "partner_search incompleto" que colarse acá —
--     el filtro de player2_id es una defensa extra, no la única barrera.
--
-- Idempotencia / regeneración seguras:
--   - Si la categoría ya tiene zonas generadas pero NINGÚN tournament_match
--     todavía (nada depende de esa distribución), regenerar es seguro: se
--     borran las zonas viejas (el FK de tournament_registrations.zone_id es
--     ON DELETE SET NULL) y se crean de cero. Doble click / retry no duplica:
--     el lock FOR UPDATE de la categoría serializa llamadas concurrentes, y
--     cada llamada reemplaza por completo en vez de sumar.
--   - Si ya existe al menos un tournament_match para la categoría, la
--     regeneración se bloquea (reason 'matches_exist') — eso significa que ya
--     se armó competencia real sobre esa distribución.
create or replace function public.tournament_generate_zones(
  p_category_id uuid,
  p_zone_count integer
)
returns table (
  ok boolean,
  reason text,
  zones_created integer,
  registrations_placed integer,
  zone_sizes integer[]
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_cat public.tournament_categories%rowtype;
  v_t public.tournaments%rowtype;
  v_total int;
  v_base int;
  v_extra int;
  v_zone_id uuid;
  v_zone_name text;
  v_size int;
  v_idx int;
  v_cursor_pos int := 0;
  v_sizes int[] := '{}';
begin
  if p_zone_count is null or p_zone_count < 1 then
    return query select false, 'invalid_zone_count'::text, 0, 0, null::int[];
    return;
  end if;

  select * into v_cat from public.tournament_categories where id = p_category_id for update;
  if not found then
    return query select false, 'category_not_found'::text, 0, 0, null::int[];
    return;
  end if;

  select * into v_t from public.tournaments where id = v_cat.tournament_id;

  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or not exists (
      select 1 from public.clubs c where c.id = v_t.club_id and c.owner_id = auth.uid()
    ) then
      return query select false, 'forbidden'::text, 0, 0, null::int[];
      return;
    end if;
  end if;

  if exists (select 1 from public.tournament_matches where category_id = p_category_id) then
    return query select false, 'matches_exist'::text, 0, 0, null::int[];
    return;
  end if;

  select count(*)::int into v_total
  from public.tournament_registrations r
  where r.category_id = p_category_id
    and r.payment_status = 'approved'
    and not r.waitlist
    and (coalesce(v_t.is_individual, false) or r.player2_id is not null);

  if v_total < p_zone_count * 2 then
    return query select false, 'not_enough_registrations'::text, 0, v_total, null::int[];
    return;
  end if;

  -- Reemplaza cualquier generación previa (ya se validó arriba que no hay
  -- partidos que dependan de ella). El FK zone_id ON DELETE SET NULL libera
  -- a las inscripciones de la zona vieja antes de reasignarlas.
  delete from public.tournament_zones where category_id = p_category_id;

  create temporary table tmp_zone_regs on commit drop as
  select r.id, row_number() over (order by random()) as rn
  from public.tournament_registrations r
  where r.category_id = p_category_id
    and r.payment_status = 'approved'
    and not r.waitlist
    and (coalesce(v_t.is_individual, false) or r.player2_id is not null);

  v_base := v_total / p_zone_count;
  v_extra := v_total % p_zone_count;

  for v_idx in 0 .. p_zone_count - 1 loop
    v_zone_name := case when v_idx < 26 then chr(65 + v_idx) else chr(65 + (v_idx / 26) - 1) || chr(65 + (v_idx % 26)) end;
    v_size := v_base + (case when v_idx < v_extra then 1 else 0 end);
    v_sizes := v_sizes || v_size;

    insert into public.tournament_zones (category_id, name, sort_order)
    values (p_category_id, v_zone_name, v_idx)
    returning id into v_zone_id;

    update public.tournament_registrations r
    set zone_id = v_zone_id
    from tmp_zone_regs tmp
    where r.id = tmp.id
      and tmp.rn > v_cursor_pos
      and tmp.rn <= v_cursor_pos + v_size;

    v_cursor_pos := v_cursor_pos + v_size;
  end loop;

  update public.tournament_categories
  set zones_count = p_zone_count, zones_generated_at = now()
  where id = p_category_id;

  return query select true, 'ok'::text, p_zone_count, v_total, v_sizes;
end;
$$;

revoke all on function public.tournament_generate_zones(uuid, integer) from public, anon;
grant execute on function public.tournament_generate_zones(uuid, integer) to authenticated, service_role;
