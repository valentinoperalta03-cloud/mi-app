-- Torneos V2 · Fase B (cierre final) · Unicidad jugador↔categoría
--
-- Regla nueva: un jugador PUEDE participar en varias categorías del mismo
-- torneo (7ma Caballeros Y Mixto Suma 15), pero NO puede aparecer dos veces
-- como inscripción viva de la MISMA categoría — sea como player1 o player2,
-- en cualquier combinación (player1+player1, player1+player2, player2+player2).
--
-- Por qué NO alcanza un índice único (category_id, player1_id):
--   No dice nada de player2_id. Jugador X como player1 en una pareja y
--   player2 en otra de la misma categoría pasaría sin ser detectado.
-- Por qué NO alcanza un índice único (category_id, player1_id) MÁS otro
-- (category_id, player2_id) por separado:
--   Son dos índices independientes sobre columnas distintas. X como player1
--   en la fila A y X como player2 en la fila B no colisiona en NINGUNO de
--   los dos (cada índice solo se fija en su propia columna) — exactamente el
--   caso que el pedido marca como inválido y que hay que bloquear.
--
-- Mecanismo elegido: tabla-sombra con clave primaria (category_id, player_id)
-- + trigger AFTER que la mantiene sincronizada con tournament_registrations.
-- La PK es la garantía dura: solo puede existir UNA fila reclamando un
-- (categoría, jugador) en un momento dado, sin importar si ese jugador está
-- en player1 o player2 de tournament_registrations. Al ser una tabla real con
-- un índice único de verdad (no un chequeo de aplicación), esto:
--   - protege incluso escrituras que NO pasan por tournament_register_entry
--     (ej. el merge de peña en app/admin/torneos/[id]/actions.ts, que escribe
--     con service role directo);
--   - resuelve la concurrencia mediante el propio locking de fila del INSERT
--     sobre la clave primaria: dos transacciones que compiten por el mismo
--     (categoría, jugador) se serializan ahí mismo — la segunda espera a que
--     la primera termine y, si esta commiteó, revienta con unique_violation.
--
-- La tabla solo contiene inscripciones VIVAS (pending_payment, pending,
-- approved): el trigger borra la fila de la sombra en cuanto la inscripción
-- deja de estar viva (cancelled/expired/refunded), liberando el lugar.
--
-- No se aplicó en ningún ambiente remoto. Forward-only.

-- ---------------------------------------------------------------------------
-- Retirar el índice legacy: bloqueaba a un jugador de anotarse en una
-- SEGUNDA categoría del mismo torneo, lo cual ahora es válido. Dejarlo
-- coexistir con la regla nueva sería tener dos reglas contradictorias.
-- ---------------------------------------------------------------------------
drop index if exists public.tournament_registrations_active_player1_uidx;
drop index if exists public.tournament_registrations_active_player2_uidx;

-- ---------------------------------------------------------------------------
-- Tabla-sombra
-- ---------------------------------------------------------------------------
create table if not exists public.tournament_category_participants (
  category_id uuid not null references public.tournament_categories (id) on delete cascade,
  player_id uuid not null,
  registration_id uuid not null references public.tournament_registrations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (category_id, player_id)
);

create index if not exists tournament_category_participants_registration_idx
  on public.tournament_category_participants (registration_id);

alter table public.tournament_category_participants enable row level security;
-- Sin policies: nadie autenticado ni anon lee ni escribe esta tabla directo,
-- es contabilidad interna mantenida solo por el trigger de abajo.
revoke all on public.tournament_category_participants from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: mantiene la sombra sincronizada con cualquier escritura a
-- tournament_registrations, sin importar quién la haga (RPC, service role
-- de un server action, el webhook de MP, el barrido de vencimiento).
-- ---------------------------------------------------------------------------
create or replace function public.tournament_registrations_sync_participants()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_live constant text[] := array['pending_payment', 'pending', 'approved'];
begin
  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.tournament_category_participants where registration_id = old.id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.category_id is not null and new.payment_status = any (v_live) then
    insert into public.tournament_category_participants (category_id, player_id, registration_id)
    values (new.category_id, new.player1_id, new.id);
    if new.player2_id is not null then
      insert into public.tournament_category_participants (category_id, player_id, registration_id)
      values (new.category_id, new.player2_id, new.id);
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists tournament_registrations_sync_participants on public.tournament_registrations;
create trigger tournament_registrations_sync_participants
  after insert or delete or update of category_id, player1_id, player2_id, payment_status
  on public.tournament_registrations
  for each row execute function public.tournament_registrations_sync_participants();

-- Backfill: poblar la sombra con las inscripciones vivas que ya existan.
insert into public.tournament_category_participants (category_id, player_id, registration_id)
select r.category_id, r.player1_id, r.id
from public.tournament_registrations r
where r.category_id is not null
  and r.payment_status in ('pending_payment', 'pending', 'approved')
on conflict (category_id, player_id) do nothing;

insert into public.tournament_category_participants (category_id, player_id, registration_id)
select r.category_id, r.player2_id, r.id
from public.tournament_registrations r
where r.category_id is not null
  and r.player2_id is not null
  and r.payment_status in ('pending_payment', 'pending', 'approved')
on conflict (category_id, player_id) do nothing;

-- ---------------------------------------------------------------------------
-- tournament_register_entry: los chequeos amigables ("ya estás inscripto",
-- "tu compañero ya está anotado") ahora se hacen POR CATEGORÍA, no por
-- torneo entero, para permitir que el mismo jugador esté en dos categorías
-- del mismo torneo. La tabla-sombra es la garantía dura de respaldo: si dos
-- requests concurrentes pasan el chequeo amigable a la vez, el INSERT/UPDATE
-- final choca contra su PK y se traduce a un reason claro en vez de romper
-- la función entera con un error crudo.
-- ---------------------------------------------------------------------------
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

  -- "Activa" = ocupa cupo hoy. Ahora escopeado por CATEGORÍA (antes por
  -- torneo entero): el mismo jugador puede tener una fila viva en la
  -- categoría A y otra en la B sin pisarse.
  select r.id, r.player1_id, r.payment_status, coalesce(r.amount_paid, 0)
    into v_existing_id, v_existing_p1, v_existing_status, v_existing_paid
  from public.tournament_registrations r
  where r.category_id = v_cat.id
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
    where r.category_id = v_cat.id
      and r.payment_status in ('pending_payment', 'pending', 'approved')
      and (r.player1_id = p_partner_id or r.player2_id = p_partner_id)
      and r.id is distinct from v_existing_id
  ) then
    return query select false, 'partner_already_registered'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
    return;
  end if;

  -- Cupo: por categoría (v_cat.max_pairs), salvo la fila que se reutiliza.
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

  v_multiplier := case when v_cat.price_unit = 'player' and not coalesce(v_t.is_individual, false) then 2 else 1 end;
  v_price := greatest(coalesce(v_cat.price_per_pair, 0), 0) * v_multiplier;

  if p_payment_method = 'mp' then
    v_status := 'pending_payment';
    v_expires := now() + interval '20 minutes';
  else
    v_status := 'pending';
    v_expires := null;
  end if;

  -- El chequeo de arriba ya cubre el caso normal; esto es la red de
  -- seguridad para la carrera (dos requests concurrentes pasan el chequeo a
  -- la vez): la tabla-sombra choca en su PK (category_id, player_id) y se
  -- traduce a un reason legible en vez de un error crudo de Postgres.
  begin
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
  exception when unique_violation then
    return query select false, 'category_player_conflict'::text, null::uuid, null::numeric, false, null::boolean, null::text, null::numeric;
    return;
  end;

  return query select true, 'ok'::text, v_new_id, v_price, false, v_cat.requires_deposit, v_cat.deposit_type, v_cat.deposit_value;
end;
$$;

revoke all on function public.tournament_register_entry(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.tournament_register_entry(uuid, uuid, text, uuid) to authenticated;
