-- Torneos V2 · Fase A · Configuración comercial por categoría
--
-- Hasta acá, precio/seña/métodos de pago vivían en `tournaments` (una sola
-- config para todo el torneo). Como un torneo va a tener N categorías
-- (tournament_categories, Fase A) con precios distintos entre sí, esa config
-- pasa a vivir POR CATEGORÍA. tournament_register_entry lee siempre de la
-- categoría de la inscripción, nunca de tournaments.
--
-- Compatibilidad: las columnas de `tournaments` NO se borran (quedan como
-- default/legacy — el wizard de creación todavía las escribe hasta que la
-- Fase B tenga UI de precio por categoría) y se copian a la categoría
-- existente de cada torneo (hoy 1:1 por el backfill de la migración anterior).

alter table public.tournament_categories add column if not exists price_per_pair numeric not null default 0;
alter table public.tournament_categories add column if not exists price_unit text not null default 'pair';
alter table public.tournament_categories drop constraint if exists tournament_categories_price_unit_check;
alter table public.tournament_categories
  add constraint tournament_categories_price_unit_check check (price_unit in ('pair', 'player'));

alter table public.tournament_categories add column if not exists requires_deposit boolean not null default false;
alter table public.tournament_categories add column if not exists deposit_type text;
alter table public.tournament_categories add column if not exists deposit_value numeric not null default 0;
alter table public.tournament_categories drop constraint if exists tournament_categories_deposit_type_check;
alter table public.tournament_categories
  add constraint tournament_categories_deposit_type_check check (deposit_type is null or deposit_type in ('percentage', 'fixed'));
-- Mismas reglas que ya validaba createTournamentAction: con seña, el tipo es
-- obligatorio y el valor tiene que ser coherente (1-100% o un monto fijo > 0).
alter table public.tournament_categories drop constraint if exists tournament_categories_deposit_value_check;
alter table public.tournament_categories
  add constraint tournament_categories_deposit_value_check check (
    not requires_deposit
    or (deposit_type = 'percentage' and deposit_value between 1 and 100)
    or (deposit_type = 'fixed' and deposit_value > 0)
  );

alter table public.tournament_categories add column if not exists accepts_mp boolean not null default true;
alter table public.tournament_categories add column if not exists accepts_cash boolean not null default false;
alter table public.tournament_categories add column if not exists accepts_transfer boolean not null default false;
alter table public.tournament_categories drop constraint if exists tournament_categories_payment_method_check;
alter table public.tournament_categories
  add constraint tournament_categories_payment_method_check check (accepts_mp or accepts_cash or accepts_transfer);

-- Backfill: copiar la config comercial actual del torneo a su categoría.
update public.tournament_categories c
set
  price_per_pair = t.price_per_pair,
  price_unit = t.price_unit,
  requires_deposit = t.requires_deposit,
  deposit_type = t.deposit_type,
  deposit_value = t.deposit_value,
  accepts_mp = t.accepts_mp,
  accepts_cash = t.accepts_cash,
  accepts_transfer = t.accepts_transfer
from public.tournaments t
where c.tournament_id = t.id;

-- tournament_registrations.category_id ya existe (migración anterior) pero
-- tournament_register_entry todavía no la completaba en el INSERT — se
-- corrige junto con este cambio, ya que ahora la categoría es la fuente de
-- precio/seña/métodos y toda fila nueva necesita quedar asociada a una.
update public.tournament_registrations r
set category_id = tc.id
from public.tournament_categories tc
where r.category_id is null
  and tc.tournament_id = r.tournament_id
  and (select count(*) from public.tournament_categories x where x.tournament_id = r.tournament_id) = 1;

-- ---------------------------------------------------------------------------
-- RPC: tournament_register_entry ahora toma precio/seña/métodos de la
-- categoría (p_category_id explícito, o la única categoría del torneo si
-- no se especifica — hoy todos los torneos tienen exactamente una). El resto
-- de las validaciones (estado, deadline, categoría permitida del jugador,
-- duplicados, cupo) no cambia.
-- ---------------------------------------------------------------------------
-- Firma vieja (3 args): PostgreSQL identifica funciones por firma completa,
-- así que agregar p_category_id con default NO reemplaza la anterior, la
-- duplica (dos overloads distintos, PostgREST/RPC podría resolver mal cuál
-- llamar). Se borra explícito antes de crear la nueva.
drop function if exists public.tournament_register_entry(uuid, uuid, text);

create or replace function public.tournament_register_entry(
  p_tournament_id uuid,
  p_partner_id uuid,
  p_payment_method text,
  p_category_id uuid default null
)
returns table (
  ok boolean,
  reason text,
  registration_id uuid,
  total_price numeric,
  reused boolean,
  requires_deposit boolean,
  deposit_type text,
  deposit_value numeric
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_t public.tournaments%rowtype;
  v_cat public.tournament_categories%rowtype;
  v_cat_count int;
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
    return query select false, 'auth_required'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
    return;
  end if;

  if p_payment_method is null or p_payment_method not in ('mp', 'cash', 'transfer') then
    return query select false, 'invalid_payment_method'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
    return;
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found then
    return query select false, 'tournament_not_found'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
    return;
  end if;

  -- Auto-vencimiento de reservas MP de ESTE torneo antes de leer cupo/duplicados.
  update public.tournament_registrations
  set payment_status = 'expired', payment_expires_at = null
  where tournament_id = p_tournament_id
    and payment_status = 'pending_payment'
    and payment_expires_at < now();

  if v_t.status <> 'open' then
    return query select false, 'registration_not_open'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
    return;
  end if;

  if v_t.registration_deadline < now() then
    return query select false, 'deadline_passed'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
    return;
  end if;

  if p_category_id is not null then
    select * into v_cat from public.tournament_categories where id = p_category_id and tournament_id = p_tournament_id;
    if not found then
      return query select false, 'category_not_found'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
      return;
    end if;
  else
    select count(*)::int into v_cat_count from public.tournament_categories where tournament_id = p_tournament_id;
    if v_cat_count <> 1 then
      return query select false, 'category_required'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
      return;
    end if;
    select * into v_cat from public.tournament_categories where tournament_id = p_tournament_id;
  end if;

  if (p_payment_method = 'mp' and not v_cat.accepts_mp)
     or (p_payment_method = 'cash' and not v_cat.accepts_cash)
     or (p_payment_method = 'transfer' and not v_cat.accepts_transfer) then
    return query select false, 'payment_method_not_accepted'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
    return;
  end if;

  if coalesce(v_t.is_individual, false) then
    if p_partner_id is not null then
      return query select false, 'individual_only'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
      return;
    end if;
  else
    if p_partner_id is null then
      return query select false, 'partner_required'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
      return;
    end if;
    if p_partner_id = v_uid then
      return query select false, 'partner_is_self'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
      return;
    end if;
    if not exists (select 1 from public.profiles where user_id = p_partner_id) then
      return query select false, 'partner_not_found'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
      return;
    end if;
  end if;

  if v_t.allowed_categories is not null and cardinality(v_t.allowed_categories) > 0 then
    select split_part(btrim(category), ' ', 1) into v_my_cat from public.profiles where user_id = v_uid;
    if v_my_cat is null or not (v_my_cat = any (v_t.allowed_categories)) then
      return query select false, 'category_not_allowed'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
      return;
    end if;
    if p_partner_id is not null then
      select split_part(btrim(category), ' ', 1) into v_partner_cat from public.profiles where user_id = p_partner_id;
      if v_partner_cat is null or not (v_partner_cat = any (v_t.allowed_categories)) then
        return query select false, 'partner_category_not_allowed'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
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
      return query select false, 'already_registered'::text, v_existing_id, null::numeric, false, null::boolean, null::text, null::numeric;
      return;
    end if;
    if v_existing_p1 <> v_uid then
      return query select false, 'pending_as_partner'::text, v_existing_id, null::numeric, false, null::boolean, null::text, null::numeric;
      return;
    end if;
    if v_existing_paid > 0 then
      return query select false, 'payment_in_progress'::text, v_existing_id, null::numeric, false, null::boolean, null::text, null::numeric;
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
    return query select false, 'partner_already_registered'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
    return;
  end if;

  -- Cupo: cuenta toda pareja formada (no solo approved), salvo la fila que
  -- se está reutilizando — esa ya estaba ocupando su lugar, no suma una vez más.
  -- Sigue siendo por TORNEO (v_t.max_pairs), no por categoría: mover el cupo a
  -- ser por categoría es un cambio aparte, no pedido en este pase.
  select count(*)::int into v_count
  from public.tournament_registrations r
  where r.tournament_id = p_tournament_id
    and not r.waitlist
    and r.payment_status in ('pending_payment', 'pending', 'approved')
    and r.id is distinct from v_existing_id;

  if v_count >= v_t.max_pairs then
    return query select false, 'tournament_full'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
    return;
  end if;

  -- "Por jugador" define el CÁLCULO del precio de la pareja, no dos pagos
  -- separados: una sola persona sigue pagando el total. Para inscripción
  -- individual (peña) no hay multiplicador — un solo jugador por fila.
  -- Precio y seña salen SIEMPRE de la categoría, nunca de v_t.
  v_multiplier := case when v_cat.price_unit = 'player' and not coalesce(v_t.is_individual, false) then 2 else 1 end;
  v_price := greatest(coalesce(v_cat.price_per_pair, 0), 0) * v_multiplier;

  if p_payment_method = 'mp' then
    v_status := 'pending_payment';
    v_expires := now() + interval '20 minutes';
  else
    v_status := 'pending';
    v_expires := null;
  end if;

  if v_existing_id is not null then
    update public.tournament_registrations
    set category_id = v_cat.id,
        player2_id = p_partner_id,
        payment_status = v_status,
        payment_method = p_payment_method,
        payment_expires_at = v_expires,
        total_price = v_price,
        amount_paid = 0,
        amount_pending = v_price,
        financial_status = 'unpaid'
    where id = v_existing_id;
    return query select true, 'ok'::text, v_existing_id, v_price, true, v_cat.requires_deposit, v_cat.deposit_type, v_cat.deposit_value;
    return;
  end if;

  insert into public.tournament_registrations (
    tournament_id, category_id, player1_id, player2_id, payment_status, payment_method,
    payment_expires_at, formed_via, waitlist, total_price, amount_paid, amount_pending, financial_status
  ) values (
    p_tournament_id, v_cat.id, v_uid, p_partner_id, v_status, p_payment_method,
    v_expires, 'direct', false, v_price, 0, v_price, 'unpaid'
  )
  returning id into v_new_id;

  return query select true, 'ok'::text, v_new_id, v_price, false, v_cat.requires_deposit, v_cat.deposit_type, v_cat.deposit_value;
end;
$$;

revoke all on function public.tournament_register_entry(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.tournament_register_entry(uuid, uuid, text, uuid) to authenticated;
