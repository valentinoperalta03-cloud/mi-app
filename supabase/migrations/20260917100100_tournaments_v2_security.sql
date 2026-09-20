-- Torneos V2 · Fase A · Seguridad
--
-- Agujeros verificados en producción (pg_policies / role_table_grants, 2026-09-16):
--   * tournament_registrations_update_own: el jugador podía hacer UPDATE de su
--     fila sin restricción de columnas (payment_status='approved',
--     financial_status='fully_paid', amount_paid…).
--   * tournament_registrations_insert_own: el jugador podía insertarse ya
--     aprobado, e incluso como player2 de una inscripción de otra persona.
--   * tournaments_delete_owner: DELETE directo desde el cliente, que en cascada
--     borraba inscripciones con historial de pagos.
--   * anon y authenticated con INSERT/UPDATE/DELETE/TRUNCATE en las tres tablas;
--     la única barrera era RLS.
--
-- Después de esta migración:
--   * anon/authenticated solo leen (SELECT) tablas de torneo.
--   * Todas las escrituras pasan por server actions con service role (con
--     ownership verificado en el servidor) o por RPC security definer.
--   * La inscripción del jugador es atómica: tournament_register_entry.

-- ---------------------------------------------------------------------------
-- Grants: solo lectura para clientes
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on public.tournaments, public.tournament_registrations, public.tournament_matches
  from anon, authenticated;
grant select on public.tournaments, public.tournament_registrations, public.tournament_matches
  to anon, authenticated;

revoke all on public.tournament_categories, public.tournament_zones, public.tournament_partner_requests
  from anon, authenticated;
grant select on public.tournament_categories, public.tournament_zones, public.tournament_partner_requests
  to anon, authenticated;
grant all on public.tournament_categories, public.tournament_zones, public.tournament_partner_requests
  to service_role;

-- ---------------------------------------------------------------------------
-- Policies: se eliminan todas las de escritura (nombres de producción y de
-- migraciones viejas) y se recrean solo las de lectura.
-- ---------------------------------------------------------------------------
drop policy if exists "tournaments_select_auth" on public.tournaments;
drop policy if exists "tournaments_owner_all" on public.tournaments;
drop policy if exists "tournaments_select_all" on public.tournaments;
drop policy if exists "tournaments_insert_owner" on public.tournaments;
drop policy if exists "tournaments_update_owner" on public.tournaments;
drop policy if exists "tournaments_delete_owner" on public.tournaments;
drop policy if exists "tournaments_select_public" on public.tournaments;

create policy "tournaments_select_public"
  on public.tournaments for select to anon, authenticated using (true);

drop policy if exists "tournament_registrations_select_auth" on public.tournament_registrations;
drop policy if exists "tournament_registrations_insert_self" on public.tournament_registrations;
drop policy if exists "tournament_registrations_owner_insert" on public.tournament_registrations;
drop policy if exists "tournament_registrations_update_self" on public.tournament_registrations;
drop policy if exists "tournament_registrations_owner_update" on public.tournament_registrations;
drop policy if exists "tournament_registrations_owner_delete" on public.tournament_registrations;
drop policy if exists "tournament_registrations_insert_own" on public.tournament_registrations;
drop policy if exists "tournament_registrations_update_own" on public.tournament_registrations;
drop policy if exists "tournament_registrations_update_admin" on public.tournament_registrations;
drop policy if exists "tournament_registrations_delete_admin" on public.tournament_registrations;
drop policy if exists "tournament_registrations_select_own" on public.tournament_registrations;
drop policy if exists "tournament_registrations_select_admin" on public.tournament_registrations;

create policy "tournament_registrations_select_own"
  on public.tournament_registrations for select to authenticated
  using (player1_id = auth.uid() or player2_id = auth.uid());

create policy "tournament_registrations_select_admin"
  on public.tournament_registrations for select to authenticated
  using (
    exists (
      select 1 from public.tournaments t
      join public.clubs c on c.id = t.club_id
      where t.id = tournament_registrations.tournament_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "tournament_matches_select_auth" on public.tournament_matches;
drop policy if exists "tournament_matches_owner_write" on public.tournament_matches;
drop policy if exists "tournament_matches_select_all" on public.tournament_matches;
drop policy if exists "tournament_matches_select_public" on public.tournament_matches;

create policy "tournament_matches_select_public"
  on public.tournament_matches for select to anon, authenticated using (true);

alter table public.tournament_categories enable row level security;
alter table public.tournament_zones enable row level security;
alter table public.tournament_partner_requests enable row level security;

drop policy if exists "tournament_categories_select_public" on public.tournament_categories;
create policy "tournament_categories_select_public"
  on public.tournament_categories for select to anon, authenticated using (true);

drop policy if exists "tournament_zones_select_public" on public.tournament_zones;
create policy "tournament_zones_select_public"
  on public.tournament_zones for select to anon, authenticated using (true);

drop policy if exists "tournament_partner_requests_select_own" on public.tournament_partner_requests;
create policy "tournament_partner_requests_select_own"
  on public.tournament_partner_requests for select to authenticated
  using (player_id = auth.uid());

drop policy if exists "tournament_partner_requests_select_admin" on public.tournament_partner_requests;
create policy "tournament_partner_requests_select_admin"
  on public.tournament_partner_requests for select to authenticated
  using (
    exists (
      select 1 from public.tournaments t
      join public.clubs c on c.id = t.club_id
      where t.id = tournament_partner_requests.tournament_id and c.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Integridad de inscripciones activas
-- ---------------------------------------------------------------------------
-- Un jugador no puede tener dos inscripciones activas en el mismo torneo como
-- player1 ni como player2. El cruce (player1 en una, player2 en otra) lo
-- controla tournament_register_entry bajo lock del torneo. "Activa" incluye
-- pending_payment: no se puede usar now() en un índice parcial (no es
-- inmutable), así que tournament_register_entry vence en el momento las
-- filas pending_payment de ESE torneo antes de chequear/insertar — el índice
-- nunca ve una fila "activa" que en los hechos ya venció.
create unique index if not exists tournament_registrations_active_player1_uidx
  on public.tournament_registrations (tournament_id, player1_id)
  where payment_status in ('pending_payment', 'pending', 'approved');
create unique index if not exists tournament_registrations_active_player2_uidx
  on public.tournament_registrations (tournament_id, player2_id)
  where payment_status in ('pending_payment', 'pending', 'approved') and player2_id is not null;

-- ---------------------------------------------------------------------------
-- Vencimiento de reservas de cupo por Mercado Pago
-- ---------------------------------------------------------------------------
-- Barrido general (para listados/paneles que quieren ver el estado real sin
-- pasar por el RPC de inscripción). No es la fuente de corrección: eso lo
-- garantiza el vencimiento inline dentro de tournament_register_entry.
create or replace function public.tournament_expire_pending_payments()
returns integer
language sql
security definer
set search_path = public
as $$
  with expired as (
    update public.tournament_registrations
    set payment_status = 'expired', payment_expires_at = null
    where payment_status = 'pending_payment' and payment_expires_at < now()
    returning id
  )
  select count(*)::int from expired;
$$;

revoke all on function public.tournament_expire_pending_payments() from public, anon, authenticated;
grant execute on function public.tournament_expire_pending_payments() to service_role;

-- ---------------------------------------------------------------------------
-- RPC: inscripción atómica
-- ---------------------------------------------------------------------------
-- Toma lock de la fila del torneo (FOR UPDATE): dos inscripciones del mismo
-- torneo se serializan, así el último cupo lo obtiene una sola.
-- Idempotente: si el jugador ya tiene una inscripción activa como titular,
-- la reutiliza (actualiza compañero y montos) en vez de crear otra; así los
-- links de Mercado Pago generados antes siguen apuntando a la misma fila.
-- El estado financiero inicial lo define el servidor; el cliente no manda montos.
--
-- Cupo: una pareja FORMADA ocupa cupo desde que se crea (pending_payment,
-- pending o approved), no recién cuando MP aprueba — si no, se podría vender
-- el último lugar dos veces mientras alguien tiene el checkout abierto. Una
-- reserva de pago por MP vence a los 20 minutos (payment_expires_at); antes
-- de leer nada de este torneo, esta función vence in-line sus propias filas
-- pending_payment ya vencidas (pasan a 'expired', liberan cupo, no se
-- borra el historial) — así el índice único de "inscripción activa" y el
-- conteo de cupo nunca ven una reserva vencida como si siguiera viva, sin
-- depender de que corra el barrido general (tournament_expire_pending_payments).
create or replace function public.tournament_register_entry(
  p_tournament_id uuid,
  p_partner_id uuid,
  p_payment_method text
)
returns table (
  ok boolean,
  reason text,
  registration_id uuid,
  total_price numeric,
  reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_t public.tournaments%rowtype;
  v_my_cat text;
  v_partner_cat text;
  v_existing_id uuid;
  v_existing_p1 uuid;
  v_existing_status text;
  v_existing_paid numeric;
  v_count int;
  v_multiplier numeric;
  v_price numeric;
  v_status text;
  v_expires timestamptz;
  v_new_id uuid;
begin
  if v_uid is null then
    return query select false, 'auth_required'::text, null::uuid, null::numeric, false;
    return;
  end if;

  if p_payment_method is null or p_payment_method not in ('mp', 'cash', 'transfer') then
    return query select false, 'invalid_payment_method'::text, null::uuid, null::numeric, false;
    return;
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found then
    return query select false, 'tournament_not_found'::text, null::uuid, null::numeric, false;
    return;
  end if;

  -- Auto-vencimiento de reservas MP de ESTE torneo antes de leer cupo/duplicados.
  update public.tournament_registrations
  set payment_status = 'expired', payment_expires_at = null
  where tournament_id = p_tournament_id
    and payment_status = 'pending_payment'
    and payment_expires_at < now();

  if v_t.status <> 'open' then
    return query select false, 'registration_not_open'::text, null::uuid, null::numeric, false;
    return;
  end if;

  if v_t.registration_deadline < now() then
    return query select false, 'deadline_passed'::text, null::uuid, null::numeric, false;
    return;
  end if;

  if (p_payment_method = 'mp' and not coalesce(v_t.accepts_mp, true))
     or (p_payment_method = 'cash' and not coalesce(v_t.accepts_cash, false))
     or (p_payment_method = 'transfer' and not coalesce(v_t.accepts_transfer, false)) then
    return query select false, 'payment_method_not_accepted'::text, null::uuid, null::numeric, false;
    return;
  end if;

  if coalesce(v_t.is_individual, false) then
    if p_partner_id is not null then
      return query select false, 'individual_only'::text, null::uuid, null::numeric, false;
      return;
    end if;
  else
    if p_partner_id is null then
      return query select false, 'partner_required'::text, null::uuid, null::numeric, false;
      return;
    end if;
    if p_partner_id = v_uid then
      return query select false, 'partner_is_self'::text, null::uuid, null::numeric, false;
      return;
    end if;
    if not exists (select 1 from public.profiles where user_id = p_partner_id) then
      return query select false, 'partner_not_found'::text, null::uuid, null::numeric, false;
      return;
    end if;
  end if;

  if v_t.allowed_categories is not null and cardinality(v_t.allowed_categories) > 0 then
    select split_part(btrim(category), ' ', 1) into v_my_cat from public.profiles where user_id = v_uid;
    if v_my_cat is null or not (v_my_cat = any (v_t.allowed_categories)) then
      return query select false, 'category_not_allowed'::text, null::uuid, null::numeric, false;
      return;
    end if;
    if p_partner_id is not null then
      select split_part(btrim(category), ' ', 1) into v_partner_cat from public.profiles where user_id = p_partner_id;
      if v_partner_cat is null or not (v_partner_cat = any (v_t.allowed_categories)) then
        return query select false, 'partner_category_not_allowed'::text, null::uuid, null::numeric, false;
        return;
      end if;
    end if;
  end if;

  -- "Activa" = ocupa cupo hoy: pending_payment ya quedó vencida arriba si correspondía.
  select r.id, r.player1_id, r.payment_status, coalesce(r.amount_paid, 0)
    into v_existing_id, v_existing_p1, v_existing_status, v_existing_paid
  from public.tournament_registrations r
  where r.tournament_id = p_tournament_id
    and r.payment_status in ('pending_payment', 'pending', 'approved')
    and (r.player1_id = v_uid or r.player2_id = v_uid)
  order by (r.payment_status = 'approved') desc, r.registered_at
  limit 1;

  if v_existing_id is not null then
    if v_existing_status = 'approved' then
      return query select false, 'already_registered'::text, v_existing_id, null::numeric, false;
      return;
    end if;
    if v_existing_p1 <> v_uid then
      return query select false, 'pending_as_partner'::text, v_existing_id, null::numeric, false;
      return;
    end if;
    if v_existing_paid > 0 then
      return query select false, 'payment_in_progress'::text, v_existing_id, null::numeric, false;
      return;
    end if;
  end if;

  if p_partner_id is not null and exists (
    select 1 from public.tournament_registrations r
    where r.tournament_id = p_tournament_id
      and r.payment_status in ('pending_payment', 'pending', 'approved')
      and (r.player1_id = p_partner_id or r.player2_id = p_partner_id)
      and r.id is distinct from v_existing_id
  ) then
    return query select false, 'partner_already_registered'::text, null::uuid, null::numeric, false;
    return;
  end if;

  -- Cupo: cuenta toda pareja formada (no solo approved), salvo la fila que
  -- se está reutilizando — esa ya estaba ocupando su lugar, no suma una vez más.
  select count(*)::int into v_count
  from public.tournament_registrations r
  where r.tournament_id = p_tournament_id
    and not r.waitlist
    and r.payment_status in ('pending_payment', 'pending', 'approved')
    and r.id is distinct from v_existing_id;

  if v_count >= v_t.max_pairs then
    return query select false, 'tournament_full'::text, null::uuid, null::numeric, false;
    return;
  end if;

  -- "Por jugador" define el CÁLCULO del precio de la pareja, no dos pagos
  -- separados: una sola persona sigue pagando el total. Para inscripción
  -- individual (peña) no hay multiplicador — un solo jugador por fila.
  v_multiplier := case when v_t.price_unit = 'player' and not coalesce(v_t.is_individual, false) then 2 else 1 end;
  v_price := greatest(coalesce(v_t.price_per_pair, 0), 0) * v_multiplier;

  if p_payment_method = 'mp' then
    v_status := 'pending_payment';
    v_expires := now() + interval '20 minutes';
  else
    v_status := 'pending';
    v_expires := null;
  end if;

  if v_existing_id is not null then
    update public.tournament_registrations
    set player2_id = p_partner_id,
        payment_status = v_status,
        payment_method = p_payment_method,
        payment_expires_at = v_expires,
        total_price = v_price,
        amount_paid = 0,
        amount_pending = v_price,
        financial_status = 'unpaid'
    where id = v_existing_id;
    return query select true, 'ok'::text, v_existing_id, v_price, true;
    return;
  end if;

  insert into public.tournament_registrations (
    tournament_id, player1_id, player2_id, payment_status, payment_method,
    payment_expires_at, formed_via, waitlist, total_price, amount_paid, amount_pending, financial_status
  ) values (
    p_tournament_id, v_uid, p_partner_id, v_status, p_payment_method,
    v_expires, 'direct', false, v_price, 0, v_price, 'unpaid'
  )
  returning id into v_new_id;

  return query select true, 'ok'::text, v_new_id, v_price, false;
end;
$$;

revoke all on function public.tournament_register_entry(uuid, uuid, text) from public, anon;
grant execute on function public.tournament_register_entry(uuid, uuid, text) to authenticated;
