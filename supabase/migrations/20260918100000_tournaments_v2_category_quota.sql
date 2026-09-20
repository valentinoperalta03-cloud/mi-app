-- Torneos V2 · Fase B (cierre) · Cupo por categoría
--
-- tournament_register_entry contaba el cupo contra tournaments.max_pairs
-- (todo el torneo), a pesar de que cada tournament_categories ya tiene su
-- propio max_pairs desde la Fase A. Con esto, llenar una categoría bloqueaba
-- la inscripción a CUALQUIER categoría del mismo torneo.
--
-- No se aplicó en ningún ambiente remoto. Forward-only sobre lo que dejaron
-- 20260917100000/100100/100200/130000 — ninguna de esas se edita. La firma de
-- la función no cambia (uuid, uuid, text, uuid), así que un simple
-- CREATE OR REPLACE alcanza (no hace falta DROP como en 100200, que sí
-- cambiaba la firma).
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

  -- Cupo: POR CATEGORÍA (v_cat.max_pairs, no v_t.max_pairs) — llenar 8va no
  -- puede bloquear 7ma ni Mixto del mismo torneo. Cuenta toda pareja formada
  -- (no solo approved: pending y pending_payment no vencida también ocupan
  -- cupo, por la misma razón de siempre — no vender el último lugar dos
  -- veces), salvo la fila que se está reutilizando, que ya estaba ocupando
  -- su lugar y no debe sumar una vez más.
  select count(*)::int into v_count
  from public.tournament_registrations r
  where r.category_id = v_cat.id
    and not r.waitlist
    and r.payment_status in ('pending_payment', 'pending', 'approved')
    and r.id is distinct from v_existing_id;

  if v_count >= v_cat.max_pairs then
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

-- Grants sin cambios (misma firma), se repiten por prolijidad/idempotencia.
revoke all on function public.tournament_register_entry(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.tournament_register_entry(uuid, uuid, text, uuid) to authenticated;
