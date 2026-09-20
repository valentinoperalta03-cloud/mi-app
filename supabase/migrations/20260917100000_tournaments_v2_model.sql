-- Torneos V2 · Fase A · Modelo
--
-- Estado de producción verificado con SELECT (2026-09-16), que NO coincide con
-- las migraciones viejas del repo:
--   * tournaments: sin CHECK de status; valores actuales: open, cancelled.
--   * tournament_registrations: sin UNIQUE(tournament_id, player1_id), sin CHECK
--     de payment_status (valores actuales: pending, approved), sin FK a auth.users.
--   * tournament_matches: 0 filas, scheduled_time es time, sin CHECK de status.
--   * court_blocks: date y start_time NOT NULL; 0 filas con reason = 'torneo'.
--
-- Esta migración solo agrega (tablas, columnas, constraints, triggers) y hace
-- backfill sin borrar datos. Es idempotente.
--
-- Decisiones:
--   * Se mantiene el literal 'open' como "inscripción abierta" para no romper
--     el código existente; se suman 'draft' y 'ready'.
--   * Un torneo pasa a tener N categorías (tournament_categories). Los torneos
--     existentes reciben una categoría backfilleada desde allowed_categories.
--   * Fuente de verdad de ocupación de un partido de torneo: tournament_matches
--     (court_id + scheduled_date + scheduled_time + duration_minutes). court_blocks
--     queda como proyección escrita SOLO por trigger en la misma transacción,
--     así nunca puede quedar un partido agendado sin su bloqueo (ni al revés).

-- ---------------------------------------------------------------------------
-- tournaments
-- ---------------------------------------------------------------------------
alter table public.tournaments drop constraint if exists tournaments_tournament_type_check;
alter table public.tournaments
  add constraint tournaments_tournament_type_check
  check (tournament_type in ('americano', 'eliminacion', 'pena', 'zonas'));

alter table public.tournaments drop constraint if exists tournaments_status_check;
alter table public.tournaments
  add constraint tournaments_status_check
  check (status in ('draft', 'open', 'registration_closed', 'ready', 'in_progress', 'finished', 'cancelled'));

alter table public.tournaments add column if not exists price_unit text not null default 'pair';
alter table public.tournaments drop constraint if exists tournaments_price_unit_check;
alter table public.tournaments
  add constraint tournaments_price_unit_check check (price_unit in ('pair', 'player'));

-- Formato por defecto + overrides por fase ({default, zone?, knockout?, final?}).
-- Se valida en la app (lib/tournament/v2/results.ts validateMatchFormat).
alter table public.tournaments add column if not exists match_formats jsonb;

-- ---------------------------------------------------------------------------
-- tournament_categories
-- ---------------------------------------------------------------------------
create table if not exists public.tournament_categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  modality text check (modality in ('caballeros', 'damas', 'mixto')),
  category_kind text not null default 'open' check (category_kind in ('open', 'traditional', 'suma')),
  -- Niveles 1..8 ("1ra".."8va") permitidos en una categoría tradicional.
  levels smallint[],
  -- Suma exacta de niveles de la pareja (8va + 8va = 16 es el máximo).
  suma_target smallint check (suma_target between 2 and 16),
  max_pairs integer not null check (max_pairs >= 2),
  guaranteed_matches integer check (guaranteed_matches >= 1),
  zones_count integer check (zones_count >= 1),
  playoff_size integer check (playoff_size >= 2 and (playoff_size & (playoff_size - 1)) = 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint tournament_categories_kind_fields_check check (
    (category_kind = 'open' and levels is null and suma_target is null)
    or (
      category_kind = 'traditional'
      and levels is not null
      and cardinality(levels) > 0
      and levels <@ array[1, 2, 3, 4, 5, 6, 7, 8]::smallint[]
      and suma_target is null
    )
    or (category_kind = 'suma' and suma_target is not null and levels is null)
  ),
  constraint tournament_categories_name_unique unique (tournament_id, name)
);

create index if not exists tournament_categories_tournament_idx
  on public.tournament_categories (tournament_id, sort_order);

-- Backfill: una categoría por torneo existente.
insert into public.tournament_categories (tournament_id, name, category_kind, levels, max_pairs, guaranteed_matches)
select
  t.id,
  coalesce(nullif(array_to_string(t.allowed_categories, ' · '), ''), 'General'),
  case when lv.levels is not null then 'traditional' else 'open' end,
  lv.levels,
  greatest(t.max_pairs, 2),
  case when t.guaranteed_matches >= 1 then t.guaranteed_matches end
from public.tournaments t
cross join lateral (
  select nullif(
    array(
      select distinct substring(c from '^([1-8])')::smallint
      from unnest(coalesce(t.allowed_categories, '{}'::text[])) as c
      where c ~ '^[1-8]'
      order by 1
    ),
    '{}'::smallint[]
  ) as levels
) lv
where not exists (select 1 from public.tournament_categories tc where tc.tournament_id = t.id);

-- ---------------------------------------------------------------------------
-- tournament_zones
-- ---------------------------------------------------------------------------
create table if not exists public.tournament_zones (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.tournament_categories (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint tournament_zones_name_unique unique (category_id, name),
  constraint tournament_zones_order_unique unique (category_id, sort_order)
);

-- ---------------------------------------------------------------------------
-- tournament_registrations
-- ---------------------------------------------------------------------------
alter table public.tournament_registrations
  add column if not exists category_id uuid references public.tournament_categories (id);
alter table public.tournament_registrations
  add column if not exists zone_id uuid references public.tournament_zones (id) on delete set null;

create index if not exists tournament_registrations_category_idx
  on public.tournament_registrations (category_id);

update public.tournament_registrations r
set category_id = tc.id
from public.tournament_categories tc
where r.category_id is null
  and tc.tournament_id = r.tournament_id
  and (select count(*) from public.tournament_categories x where x.tournament_id = r.tournament_id) = 1;

-- payment_status ahora distingue DOS formas de "todavía no confirmado", las
-- dos ocupan cupo desde que la pareja se forma (decisión de producto: no
-- esperar a que MP apruebe para contar el cupo, porque se podría vender el
-- último lugar dos veces):
--   pending_payment: eligió Mercado Pago, tiene payment_expires_at (default
--     20 min desde tournament_register_entry) y todavía no pagó. Si vence,
--     un job pasa la fila a 'expired' (tournament_expire_pending_payments) y
--     el cupo se libera; el historial no se borra.
--   pending: efectivo/transferencia o pareja formada por "busco compañero"
--     (esa nunca paga online). Ocupa cupo indefinidamente hasta que el club
--     cobra (-> approved) o la da de baja (-> cancelled); no vence sola.
alter table public.tournament_registrations drop constraint if exists tournament_registrations_payment_status_check;
alter table public.tournament_registrations
  add constraint tournament_registrations_payment_status_check
  check (payment_status in ('pending_payment', 'pending', 'approved', 'expired', 'cancelled', 'refunded'));

alter table public.tournament_registrations add column if not exists payment_method text
  check (payment_method is null or payment_method in ('mp', 'cash', 'transfer'));
-- Vencimiento de la reserva de cupo mientras se paga por MP. NULL para
-- pending (efectivo/transferencia, no vence) y para approved/cancelled/expired.
alter table public.tournament_registrations add column if not exists payment_expires_at timestamptz;
alter table public.tournament_registrations drop constraint if exists tournament_registrations_payment_expiry_check;
alter table public.tournament_registrations
  add constraint tournament_registrations_payment_expiry_check
  check (payment_status = 'pending_payment' or payment_expires_at is null);
-- Cómo se formó la pareja: define si puede pagar online (busco-compañero no).
alter table public.tournament_registrations add column if not exists formed_via text not null default 'direct'
  check (formed_via in ('direct', 'partner_search'));
alter table public.tournament_registrations drop constraint if exists tournament_registrations_partner_search_no_mp_check;
alter table public.tournament_registrations
  add constraint tournament_registrations_partner_search_no_mp_check
  check (formed_via <> 'partner_search' or payment_method is distinct from 'mp');
-- Un pago aprobado que llega para una fila expired/cancelled (cupo ya
-- liberado y quizás reasignado) no se puede confirmar solo: se marca para
-- que el club/soporte lo reconcilie a mano en vez de reabrir la inscripción
-- o perder el pago.
alter table public.tournament_registrations add column if not exists payment_reconciliation_needed boolean not null default false;

alter table public.tournament_registrations drop constraint if exists tournament_registrations_distinct_players_check;
alter table public.tournament_registrations
  add constraint tournament_registrations_distinct_players_check
  check (player2_id is null or player2_id <> player1_id);

-- Inscripciones pendientes creadas sin saldo pendiente (amount_pending quedaba en 0).
update public.tournament_registrations
set amount_pending = greatest(coalesce(total_price, 0) - coalesce(amount_paid, 0), 0)
where payment_status = 'pending'
  and coalesce(amount_paid, 0) = 0
  and coalesce(amount_pending, 0) = 0
  and coalesce(total_price, 0) > 0;

-- Backfill de payment_method para filas existentes (todas nacieron antes de
-- esta migración; se infiere de qué datos tienen cargados).
update public.tournament_registrations
set payment_method = case
  when mp_preference_id is not null or mp_payment_id is not null then 'mp'
  else 'cash'
end
where payment_method is null;

-- ---------------------------------------------------------------------------
-- tournament_partner_requests ("busco compañero": no ocupa cupo ni paga)
-- ---------------------------------------------------------------------------
create table if not exists public.tournament_partner_requests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid not null references public.tournament_categories (id) on delete cascade,
  player_id uuid not null references auth.users (id) on delete cascade,
  -- Snapshot al anotarse; al formar pareja se revalida contra el perfil actual.
  player_level smallint check (player_level between 1 and 8),
  player_gender text,
  position text not null default 'indistinto' check (position in ('drive', 'reves', 'indistinto')),
  status text not null default 'seeking' check (status in ('seeking', 'matched', 'withdrawn', 'cancelled')),
  registration_id uuid references public.tournament_registrations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_partner_requests_matched_check check (status <> 'matched' or registration_id is not null)
);

create unique index if not exists tournament_partner_requests_one_seeking_uidx
  on public.tournament_partner_requests (category_id, player_id)
  where status = 'seeking';
create index if not exists tournament_partner_requests_tournament_idx
  on public.tournament_partner_requests (tournament_id, status);

-- ---------------------------------------------------------------------------
-- tournament_matches
-- ---------------------------------------------------------------------------
alter table public.tournament_matches
  add column if not exists category_id uuid references public.tournament_categories (id);
alter table public.tournament_matches
  add column if not exists zone_id uuid references public.tournament_zones (id) on delete set null;
alter table public.tournament_matches add column if not exists phase text;
alter table public.tournament_matches add column if not exists bracket_slot integer;
alter table public.tournament_matches add column if not exists duration_minutes integer;
alter table public.tournament_matches add column if not exists pair1_games integer;
alter table public.tournament_matches add column if not exists pair2_games integer;
alter table public.tournament_matches add column if not exists is_draw boolean not null default false;
alter table public.tournament_matches add column if not exists tiebreak_winner smallint;
-- Control optimista para dos admins cargando el mismo resultado.
alter table public.tournament_matches add column if not exists result_version integer not null default 0;

alter table public.tournament_matches drop constraint if exists tournament_matches_phase_check;
alter table public.tournament_matches
  add constraint tournament_matches_phase_check
  check (phase is null or phase in ('americano', 'americano_final', 'zone', 'knockout', 'pena'));
alter table public.tournament_matches drop constraint if exists tournament_matches_status_check;
alter table public.tournament_matches
  add constraint tournament_matches_status_check check (status in ('pending', 'in_progress', 'finished'));
alter table public.tournament_matches drop constraint if exists tournament_matches_duration_check;
alter table public.tournament_matches
  add constraint tournament_matches_duration_check check (duration_minutes is null or duration_minutes between 10 and 300);
alter table public.tournament_matches drop constraint if exists tournament_matches_games_check;
alter table public.tournament_matches
  add constraint tournament_matches_games_check
  check ((pair1_games is null or pair1_games >= 0) and (pair2_games is null or pair2_games >= 0));
alter table public.tournament_matches drop constraint if exists tournament_matches_tiebreak_check;
alter table public.tournament_matches
  add constraint tournament_matches_tiebreak_check check (tiebreak_winner is null or tiebreak_winner in (1, 2));
alter table public.tournament_matches drop constraint if exists tournament_matches_distinct_pairs_check;
alter table public.tournament_matches
  add constraint tournament_matches_distinct_pairs_check
  check (pair1_id is null or pair2_id is null or pair1_id <> pair2_id);
alter table public.tournament_matches drop constraint if exists tournament_matches_winner_check;
alter table public.tournament_matches
  add constraint tournament_matches_winner_check
  check (winner_pair_id is null or winner_pair_id = pair1_id or winner_pair_id = pair2_id);

create index if not exists tournament_matches_category_idx on public.tournament_matches (category_id, phase);
create index if not exists tournament_matches_court_date_idx
  on public.tournament_matches (court_id, scheduled_date)
  where court_id is not null and scheduled_date is not null;

update public.tournament_matches m
set category_id = tc.id
from public.tournament_categories tc
where m.category_id is null
  and tc.tournament_id = m.tournament_id
  and (select count(*) from public.tournament_categories x where x.tournament_id = m.tournament_id) = 1;

update public.tournament_matches m
set phase = case
  when t.tournament_type = 'pena' then 'pena'
  when t.tournament_type = 'eliminacion' then 'knockout'
  when t.tournament_type = 'americano' and m.round >= 9001 then 'americano_final'
  when t.tournament_type = 'americano' then 'americano'
end
from public.tournaments t
where m.phase is null and t.id = m.tournament_id;

-- ---------------------------------------------------------------------------
-- court_blocks: proyección de partidos de torneo
-- ---------------------------------------------------------------------------
alter table public.court_blocks
  add column if not exists tournament_match_id uuid references public.tournament_matches (id) on delete cascade;
alter table public.court_blocks add column if not exists duration_minutes integer;
alter table public.court_blocks drop constraint if exists court_blocks_duration_check;
alter table public.court_blocks
  add constraint court_blocks_duration_check check (duration_minutes is null or duration_minutes between 10 and 600);

create unique index if not exists court_blocks_tournament_match_uidx
  on public.court_blocks (tournament_match_id)
  where tournament_match_id is not null;

create or replace function public.tournament_match_sync_court_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  perform set_config('padelibre.tournament_block_sync', 'on', true);

  if tg_op in ('UPDATE', 'DELETE') then
    delete from public.court_blocks where tournament_match_id = old.id;
  end if;

  if tg_op in ('INSERT', 'UPDATE')
     and new.court_id is not null
     and new.scheduled_date is not null
     and new.scheduled_time is not null then
    select status into v_status from public.tournaments where id = new.tournament_id;
    if coalesce(v_status, '') <> 'cancelled' then
      insert into public.court_blocks (
        court_id, date, start_time, blocked_date, blocked_time,
        reason, tournament_match_id, duration_minutes
      ) values (
        new.court_id, new.scheduled_date, new.scheduled_time, new.scheduled_date, new.scheduled_time,
        'torneo', new.id, coalesce(new.duration_minutes, 90)
      );
    end if;
  end if;

  perform set_config('padelibre.tournament_block_sync', 'off', true);
  return null;
end;
$$;

revoke all on function public.tournament_match_sync_court_block() from public, anon, authenticated;

drop trigger if exists tournament_matches_sync_court_block on public.tournament_matches;
create trigger tournament_matches_sync_court_block
  after insert or delete or update of court_id, scheduled_date, scheduled_time, duration_minutes, tournament_id
  on public.tournament_matches
  for each row execute function public.tournament_match_sync_court_block();

-- Los bloqueos de torneo solo los escribe el trigger de arriba (o esta misma
-- guarda, marcada con el flag padelibre.tournament_block_sync). Cualquier
-- otro insert/update/delete sobre una fila con tournament_match_id falla
-- fuerte: no hay ningún caller legítimo hoy que deba tocarlas directo.
--
-- Por qué antes esto devolvía NULL en silencio para update/delete: la duda
-- era romper leave_match_atomic, que borra court_blocks por
-- court_id+fecha+hora (sin filtrar por tournament_match_id) cuando el dueño
-- de una reserva/partido abierto se va. En operación normal ese DELETE
-- nunca puede matchear una fila de torneo: assignTournamentMatchSlot y
-- getCourtAvailabilityForDate ya tratan a tournament_matches como ocupación,
-- así que una reserva normal y un partido de torneo no pueden coexistir en
-- la misma cancha+fecha+hora. Si alguna vez matcheara, sería la señal de que
-- ese invariante se rompió — silenciarlo escondería el bug en vez de
-- mostrarlo. Por eso ahora se explota fuerte en vez de ignorarse: el DELETE
-- de leave_match_atomic solo dispara este trigger si sus criterios matchean
-- una fila (0 filas matcheadas = el trigger ni corre), así que en el camino
-- feliz esto no cambia nada; en el camino roto, aborta esa transacción en
-- vez de dejar la cancha "liberada" sobre un partido de torneo que sigue
-- vivo.
--
-- Las cascadas (borrar la cancha, o borrar el tournament_match — ej. al
-- cancelar la categoría/torneo) sí tienen que pasar: cuando el padre ya no
-- existe (not exists de abajo), se permite.
create or replace function public.court_blocks_guard_tournament_rows()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('padelibre.tournament_block_sync', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    if new.tournament_match_id is not null then
      raise exception 'court_blocks de torneo se generan desde tournament_matches'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if old.tournament_match_id is null
     or not exists (select 1 from public.tournament_matches where id = old.tournament_match_id)
     or not exists (select 1 from public.courts where id = old.court_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  raise exception 'Este bloqueo pertenece a un partido de torneo en curso: gestionalo desde el partido, no lo modifiques directo'
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists court_blocks_guard_tournament_rows on public.court_blocks;
create trigger court_blocks_guard_tournament_rows
  before insert or update or delete on public.court_blocks
  for each row execute function public.court_blocks_guard_tournament_rows();

-- ---------------------------------------------------------------------------
-- Máquina de estados del torneo
-- ---------------------------------------------------------------------------
--   draft ──► open ──► registration_closed ──► ready ──► in_progress ──► finished
--              ▲  │           │   ▲                          ▲
--              │  └───────────┼───┼──────────────────────────┘ (inicio directo, compat.)
--              └──────────────┘   │
--   Cualquier estado no terminal ──► cancelled. finished y cancelled son terminales.
create or replace function public.tournaments_guard_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'open') then
      raise exception 'Un torneo nuevo solo puede crearse como borrador o con inscripción abierta'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status in ('open', 'cancelled'))
    or (old.status = 'open' and new.status in ('registration_closed', 'in_progress', 'cancelled'))
    or (old.status = 'registration_closed' and new.status in ('open', 'ready', 'in_progress', 'cancelled'))
    or (old.status = 'ready' and new.status in ('in_progress', 'cancelled'))
    or (old.status = 'in_progress' and new.status in ('finished', 'cancelled'))
  ) then
    raise exception 'Transición de estado inválida: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if new.status = 'finished' and new.tournament_type <> 'pena' then
    if not exists (select 1 from public.tournament_matches where tournament_id = new.id) then
      raise exception 'No se puede finalizar un torneo sin partidos' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.tournament_matches where tournament_id = new.id and status <> 'finished') then
      raise exception 'No se puede finalizar un torneo con partidos sin resultado' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tournaments_guard_status on public.tournaments;
create trigger tournaments_guard_status
  before insert or update of status on public.tournaments
  for each row execute function public.tournaments_guard_status();

-- Al cancelar se liberan las canchas (los partidos y su historial quedan).
create or replace function public.tournaments_release_courts_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform set_config('padelibre.tournament_block_sync', 'on', true);
    delete from public.court_blocks cb
    using public.tournament_matches m
    where cb.tournament_match_id = m.id and m.tournament_id = new.id;
    perform set_config('padelibre.tournament_block_sync', 'off', true);
  end if;
  return null;
end;
$$;

revoke all on function public.tournaments_release_courts_on_cancel() from public, anon, authenticated;

drop trigger if exists tournaments_release_courts_on_cancel on public.tournaments;
create trigger tournaments_release_courts_on_cancel
  after update of status on public.tournaments
  for each row execute function public.tournaments_release_courts_on_cancel();
