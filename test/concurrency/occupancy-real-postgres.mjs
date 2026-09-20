// Test de concurrencia REAL contra Postgres (Fase D — hardening final).
//
// PGlite (usado en el resto de la suite de torneos) es un único
// proceso/conexión embebido: no puede abrir dos transacciones concurrentes
// de verdad, así que no puede demostrar una carrera genuina entre dos
// escritores. Este script sí la demuestra: abre DOS conexiones `pg`
// independientes, cada una en su propia transacción, y dispara ambas EN
// PARALELO (Promise.all) contra el mismo court+fecha+horario para verificar
// que el advisory lock compartido (lock_court_day) serializa correctamente
// y que nunca queda un doble booking.
//
// PRERREQUISITOS (no se hicieron acá para no tocar dependencias/infra sin
// que se pida explícitamente):
//   1. `npm install --save-dev pg` (no está en package.json todavía).
//   2. Una base Postgres real, LOCAL, vacía y descartable — NUNCA producción.
//      Ej.: `docker run --rm -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15`
//      o el stack local de `supabase start` (ninguno estaba disponible en el
//      entorno donde se preparó este archivo — no se pudo ejecutar).
//   3. Variable de entorno TEST_DATABASE_URL apuntando a esa base, ej.:
//      postgres://postgres:postgres@localhost:5432/postgres
//
// Ejecutar con: node test/concurrency/occupancy-real-postgres.mjs
//
// Este script NO se corrió nunca contra una base real en esta sesión — no
// hay entorno local de Postgres/Docker disponible acá (verificado: `docker
// ps` falla, no hay CLI de supabase). Queda preparado para correrse cuando
// haya un Postgres real a mano; no afirmar que la concurrencia fue validada
// hasta que esto corra limpio.

const DB_URL = process.env.TEST_DATABASE_URL;
if (!DB_URL) {
  console.log(
    "SKIP: falta TEST_DATABASE_URL. Este test necesita un Postgres real local (NUNCA producción). " +
      "Ver los prerrequisitos en el encabezado de este archivo.",
  );
  process.exit(0);
}

let pg;
try {
  pg = await import("pg");
} catch {
  console.log("SKIP: falta la dependencia 'pg'. Instalar con: npm install --save-dev pg");
  process.exit(0);
}
const { Client } = pg.default ?? pg;

const REPO_MIGRATIONS = [
  "20260917100000_tournaments_v2_model.sql",
  "20260917100100_tournaments_v2_security.sql",
  "20260917100200_tournaments_v2_category_pricing.sql",
  "20260917130000_tournaments_v2_zones_generation.sql",
  "20260918100000_tournaments_v2_category_quota.sql",
  "20260918100100_tournaments_v2_category_edit_guard.sql",
  "20260918110000_tournaments_v2_category_player_uniqueness.sql",
  "20260919100000_tournaments_v2_competitive_engine.sql",
  "20260920011254_clubs_requires_deposit.sql",
  "20260920011329_direct_reservation_rpc.sql",
  "20260920011345_reservation_hold_locked_insert.sql",
  "20260920100000_tournament_v2_scheduler.sql",
  "20260921100000_occupancy_lock_hardening.sql",
  "20260923100000_admin_manual_reservation_lock.sql",
  "20260924100000_reservation_hold_court_blocks_range.sql",
];

let failures = 0;
function log(ok, name, extra = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " :: " + extra : ""}`);
}

async function main() {
  const admin = new Client({ connectionString: DB_URL });
  await admin.connect();

  // --- schema mínimo (mismo shape que el stub de PGlite, pero acá SÍ hay
  // btree_gist real disponible en un Postgres de verdad) ---
  await admin.query(`
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key);
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
    end $$;
    grant usage on schema auth, public to anon, authenticated, service_role;

    create table if not exists public.clubs (id uuid primary key default gen_random_uuid(), owner_id uuid, name text, open_time time, close_time time, mp_access_token text);
    create table if not exists public.courts (id uuid primary key default gen_random_uuid(), club_id uuid references clubs(id) on delete cascade, name text);
    create table if not exists public.profiles (id uuid primary key default gen_random_uuid(), user_id uuid, category text, gender text);
    create table if not exists public.group_chats (id uuid primary key default gen_random_uuid(), tournament_id uuid);
    create table if not exists public.tournaments (
      id uuid primary key default gen_random_uuid(), club_id uuid not null references clubs(id) on delete cascade,
      name text not null, description text, tournament_type text not null default 'americano', status text not null default 'open',
      max_pairs integer not null default 8, price_per_pair numeric not null default 0, prize text,
      start_date date not null, end_date date not null, start_time time not null, registration_deadline timestamptz not null,
      cancellation_hours integer not null default 24, category_min numeric, category_max numeric,
      group_chat_id uuid references group_chats(id) on delete set null, fixture_locked boolean not null default false,
      created_at timestamptz not null default now(), requires_deposit boolean not null default false, deposit_type text,
      deposit_value numeric not null default 0, consolation_bracket boolean default false, allowed_categories text[],
      has_finals boolean default true, match_duration_minutes integer, match_format text default 'set', num_courts integer,
      multi_day boolean default false, food_included text, created_by uuid, game_format text default 'set', what_includes text,
      is_individual boolean default false, prizes jsonb, contact_phone text, guaranteed_matches integer, tournament_notes text,
      quarterfinals_date date, semifinals_date date, finals_date date, matches_per_day integer, tournament_court_blocks jsonb,
      accepts_mp boolean default true, accepts_cash boolean default false, accepts_transfer boolean default false, transfer_alias text
    );
    create table if not exists public.tournament_registrations (
      id uuid primary key default gen_random_uuid(), tournament_id uuid not null references tournaments(id) on delete cascade,
      player1_id uuid not null, player2_id uuid, payment_status text not null default 'pending', waitlist boolean not null default false,
      registered_at timestamptz not null default now(), mp_preference_id text, mp_payment_id text, amount numeric, total_price numeric,
      amount_paid numeric not null default 0, amount_pending numeric not null default 0, financial_status text not null default 'unpaid',
      registration_order integer not null default 0
    );
    create table if not exists public.tournament_matches (
      id uuid primary key default gen_random_uuid(), tournament_id uuid not null references tournaments(id) on delete cascade,
      round integer not null default 1, round_name text,
      pair1_id uuid references tournament_registrations(id) on delete set null, pair2_id uuid references tournament_registrations(id) on delete set null,
      pair1_score integer, pair2_score integer, status text not null default 'pending',
      winner_pair_id uuid references tournament_registrations(id) on delete set null,
      feeder_left_match_id uuid references tournament_matches(id) on delete set null, feeder_right_match_id uuid references tournament_matches(id) on delete set null,
      sets jsonb not null default '[]', court_id uuid references courts(id) on delete set null, scheduled_date date, scheduled_time time,
      notes text, created_at timestamptz not null default now(), bracket text default 'gold'
    );
    create table if not exists public.court_blocks (
      id uuid primary key default gen_random_uuid(), court_id uuid references courts(id) on delete cascade,
      date date not null, start_time time not null, reason text default 'Reserva Privada', created_at timestamptz default now(),
      blocked_date date, blocked_time time, created_by uuid, note text
    );
    create extension if not exists btree_gist;
    create table if not exists public.matches (
      id uuid primary key default gen_random_uuid(), court_id uuid references courts(id) on delete set null,
      scheduled_date date, scheduled_time time, duration_minutes integer, match_status text, match_type text,
      es_turno_fijo boolean default false, fixed_slot_id uuid, owner_id uuid, total_price numeric,
      payment_status text, amount_paid numeric, amount_pending numeric, financial_status text,
      location_name text, date timestamptz, confirmed_at timestamptz
    );
    create table if not exists public.match_participants (
      id uuid primary key default gen_random_uuid(), match_id uuid references matches(id) on delete cascade, player_id uuid, team integer
    );
    create table if not exists public.payments (
      id uuid primary key default gen_random_uuid(), match_id uuid references matches(id) on delete cascade,
      user_id uuid, mp_preference_id text, mp_payment_id text, status text, amount numeric, payment_method text
    );
    create table if not exists public.reservation_holds (
      id uuid primary key default gen_random_uuid(), owner_id uuid references profiles(id), club_id uuid references clubs(id),
      court_id uuid references courts(id), scheduled_date date not null, scheduled_time time not null,
      duration_minutes integer not null default 90, starts_at timestamptz not null, ends_at timestamptz not null,
      total_price numeric not null default 0, deposit_amount numeric not null default 0, location_name text,
      mp_preference_id text, external_reference text,
      status text not null default 'pending' check (status in ('pending','consumed','cancelled','expired')),
      expires_at timestamptz not null, consumed_match_id uuid references matches(id),
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    do $$ begin
      if not exists (select 1 from pg_indexes where indexname = 'one_pending_hold_per_owner') then
        create unique index one_pending_hold_per_owner on public.reservation_holds (owner_id) where status = 'pending';
      end if;
      if not exists (select 1 from pg_constraint where conname = 'reservation_holds_no_overlap') then
        alter table public.reservation_holds add constraint reservation_holds_no_overlap
          exclude using gist (court_id with =, tstzrange(starts_at, ends_at, '[)') with &&) where (status = 'pending');
      end if;
    end $$;
    create table if not exists public.fixed_slots (
      id uuid primary key default gen_random_uuid(), club_id uuid, court_id uuid references courts(id) on delete cascade,
      day_of_week integer, start_time time, duration_minutes integer, is_active boolean default true
    );
    create table if not exists public.fixed_slot_exceptions (
      id uuid primary key default gen_random_uuid(), fixed_slot_id uuid references fixed_slots(id) on delete cascade, exception_date date
    );
    create table if not exists public.training_blocks (
      id uuid primary key default gen_random_uuid(), club_id uuid, court_id uuid references courts(id) on delete cascade,
      day_of_week integer, start_time time, end_time time, is_active boolean default true
    );
    create table if not exists public.club_closed_days (
      id uuid primary key default gen_random_uuid(), club_id uuid references clubs(id) on delete cascade, closed_date date
    );
    create table if not exists public.court_time_ranges (
      id uuid primary key default gen_random_uuid(), court_id uuid references courts(id) on delete cascade,
      day_of_week integer, open_time time, close_time time
    );
    grant all on all tables in schema public to anon, authenticated, service_role;
  `);

  // --- aplicar las migraciones reales del repo ---
  const repoRoot = new URL("../../supabase/migrations/", import.meta.url);
  const { readFileSync } = await import("node:fs");
  for (const f of REPO_MIGRATIONS) {
    await admin.query(readFileSync(new URL(f, repoRoot), "utf8"));
  }

  // --- datos base ---
  const OWNER = "00000000-0000-0000-0000-00000000000a";
  const P1 = "00000000-0000-0000-0000-000000000001";
  const P2 = "00000000-0000-0000-0000-000000000002";
  const P3 = "00000000-0000-0000-0000-000000000003";
  const P4 = "00000000-0000-0000-0000-000000000004";
  const P5 = "00000000-0000-0000-0000-000000000005";
  const CLUB = "10000000-0000-0000-0000-000000000001";
  const C1 = "20000000-0000-0000-0000-000000000001";
  const C2 = "20000000-0000-0000-0000-000000000002";
  const T = "30000000-0000-0000-0000-000000000001";
  const CAT = "60000000-0000-0000-0000-000000000001";
  const DATE = "2099-05-10";

  await admin.query(`insert into auth.users (id) values ('${OWNER}'),('${P1}'),('${P2}'),('${P3}'),('${P4}'),('${P5}') on conflict do nothing`);
  await admin.query(`insert into profiles (id, user_id) values ('${P1}','${P1}'),('${P2}','${P2}'),('${P3}','${P3}'),('${P4}','${P4}'),('${P5}','${P5}') on conflict do nothing`);
  await admin.query(`insert into clubs (id, owner_id, name) values ('${CLUB}','${OWNER}','Club test') on conflict do nothing`);
  await admin.query(`insert into courts (id, club_id, name) values ('${C1}','${CLUB}','Cancha 1') on conflict do nothing`);
  await admin.query(`insert into courts (id, club_id, name) values ('${C2}','${CLUB}','Cancha 2') on conflict do nothing`);
  await admin.query(
    `insert into tournaments (id, club_id, name, tournament_type, status, max_pairs, price_per_pair, start_date, end_date, start_time, registration_deadline)
     values ('${T}','${CLUB}','T concurrencia','eliminacion','open',8,10000,'2099-01-01','2099-01-01','09:00','2099-01-01') on conflict do nothing`,
  );
  await admin.query(`insert into tournament_categories (id, tournament_id, name, max_pairs) values ('${CAT}','${T}','Cat A',8) on conflict do nothing`);
  await admin.query(
    `insert into tournament_registrations (id, tournament_id, category_id, player1_id, player2_id, payment_status)
     values ('40000000-0000-0000-0000-000000000001','${T}','${CAT}','${P1}','${P2}','approved') on conflict do nothing`,
  );

  async function asUserClient(uid) {
    const c = new Client({ connectionString: DB_URL });
    await c.connect();
    await c.query(`set role authenticated`);
    await c.query(`set request.jwt.claim.sub = '${uid}'`);
    return c;
  }
  // insert_reservation_hold_locked / create_direct_reservation / consume_reservation_hold
  // están otorgadas SOLO a service_role en producción (igual que reservarCancha
  // las invoca con serviceClient, nunca con el cliente de sesión del jugador).
  async function asServiceClient() {
    const c = new Client({ connectionString: DB_URL });
    await c.connect();
    await c.query(`set role service_role`);
    await c.query(`set request.jwt.claim.role = 'service_role'`);
    return c;
  }
  function holdRpcSql(owner, court, date, time, durationMin) {
    const startsAtExpr = `(('${date} ${time}')::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')`;
    const endsAtExpr = `(${startsAtExpr} + interval '${durationMin} minutes')`;
    return `select * from insert_reservation_hold_locked('${owner}','${CLUB}','${court}','${date}','${time}',${durationMin},${startsAtExpr},${endsAtExpr},10000,5000,'Cancha',now() + interval '10 minutes')`;
  }
  async function newMatch(id, round) {
    await admin.query(
      `insert into tournament_matches (id, tournament_id, category_id, phase, round, pair1_id, pair2_id, status)
       values ('${id}','${T}','${CAT}','zone',${round},'40000000-0000-0000-0000-000000000001',null,'pending') on conflict do nothing`,
    );
  }

  // 1) torneo vs torneo: dos partidos distintos, mismo court+fecha, horarios
  // superpuestos-no-idénticos (10:00 y 10:30, 90 min) -> solo uno ocupa.
  {
    const mA = "50000000-0000-0000-0000-000000000001";
    const mB = "50000000-0000-0000-0000-000000000002";
    await newMatch(mA, 1);
    await newMatch(mB, 2);
    const cOwner1 = await asUserClient(OWNER);
    const cOwner2 = await asUserClient(OWNER);
    const [rA, rB] = await Promise.all([
      cOwner1.query(`select * from tournament_assign_match_slot('${mA}','${C1}','${DATE}','10:00')`),
      cOwner2.query(`select * from tournament_assign_match_slot('${mB}','${C1}','${DATE}','10:30')`),
    ]);
    await cOwner1.end();
    await cOwner2.end();
    const oks = [rA.rows[0], rB.rows[0]].filter((r) => r.ok).length;
    log(oks === 1, "1) torneo vs torneo (horarios superpuestos-no-idénticos, en paralelo): exactamente UNO ocupa", JSON.stringify([rA.rows[0], rB.rows[0]]));
  }

  // 5) dos reservation_holds concurrentes en el mismo slot -> solo uno.
  {
    const cSvc1 = await asServiceClient();
    const cSvc2 = await asServiceClient();
    const [rP3, rP4] = await Promise.all([
      cSvc1.query(holdRpcSql(P3, C1, DATE, "14:00", 90)),
      cSvc2.query(holdRpcSql(P4, C1, DATE, "14:00", 90)),
    ]);
    await cSvc1.end();
    await cSvc2.end();
    const oks = [rP3.rows[0], rP4.rows[0]].filter((r) => r.ok).length;
    log(oks === 1, "5) dos reservation_holds concurrentes, mismo slot exacto: exactamente UNO ocupa", JSON.stringify([rP3.rows[0], rP4.rows[0]]));
  }

  // 2) torneo vs reservation_hold, en paralelo, mismo slot -> solo uno ocupa.
  {
    const mC = "50000000-0000-0000-0000-000000000003";
    await newMatch(mC, 3);
    const cOwner = await asUserClient(OWNER);
    const cSvc = await asServiceClient();
    const [rTorneo, rHold] = await Promise.all([
      cOwner.query(`select * from tournament_assign_match_slot('${mC}','${C1}','${DATE}','16:00')`),
      cSvc.query(holdRpcSql(P1, C1, DATE, "16:00", 90)),
    ]);
    await cOwner.end();
    await cSvc.end();
    const oks = [rTorneo.rows[0], rHold.rows[0]].filter((r) => r.ok).length;
    log(oks === 1, "2) torneo vs reservation_hold, en paralelo, mismo slot: exactamente UNO ocupa", JSON.stringify([rTorneo.rows[0], rHold.rows[0]]));
  }

  // 4) torneo vs generación de turno fijo, en paralelo, mismo slot -> no doble booking.
  {
    const mD = "50000000-0000-0000-0000-000000000004";
    await newMatch(mD, 4);
    const fs = "80000000-0000-0000-0000-000000000001";
    const dow = new Date(`${DATE}T12:00:00Z`).getUTCDay();
    await admin.query(
      `insert into fixed_slots (id, club_id, court_id, day_of_week, start_time, duration_minutes, is_active)
       values ('${fs}','${CLUB}','${C1}',${dow},'18:00',90,true) on conflict do nothing`,
    );
    const cOwner = await asUserClient(OWNER);
    const [rTorneo, rFixed] = await Promise.all([
      cOwner.query(`select * from tournament_assign_match_slot('${mD}','${C1}','${DATE}','18:00')`),
      admin.query(`select * from generate_fixed_slot_occurrence('${fs}','${DATE}','${P1}','Cancha 1',10000,false)`),
    ]);
    await cOwner.end();
    const torneoOk = rTorneo.rows[0]?.ok === true;
    const fixedCreated = rFixed.rows[0]?.generate_fixed_slot_occurrence?.status === "created";
    log(
      !(torneoOk && fixedCreated),
      "4) torneo vs generación de turno fijo, en paralelo, mismo slot: nunca los dos ganan a la vez",
      JSON.stringify({ torneoOk, fixedResult: rFixed.rows[0]?.generate_fixed_slot_occurrence }),
    );
  }

  // 6) solapamiento parcial (no exacto) también queda protegido: reservation_hold
  // 20:00-21:30 vs torneo pidiendo 20:30 (superpuesto, no coincide la hora).
  {
    const mE = "50000000-0000-0000-0000-000000000005";
    await newMatch(mE, 5);
    const cOwner = await asUserClient(OWNER);
    const cSvc = await asServiceClient();
    const [rHold, rTorneo] = await Promise.all([
      cSvc.query(holdRpcSql(P2, C1, DATE, "20:00", 90)),
      cOwner.query(`select * from tournament_assign_match_slot('${mE}','${C1}','${DATE}','20:30')`),
    ]);
    await cOwner.end();
    await cSvc.end();
    const oks = [rHold.rows[0], rTorneo.rows[0]].filter((r) => r.ok).length;
    log(oks <= 1, "6) solapamiento PARCIAL (hold 20:00-21:30 vs torneo pidiendo 20:30): nunca los dos ganan a la vez", JSON.stringify([rHold.rows[0], rTorneo.rows[0]]));
  }

  // 3) torneo vs conversión hold->match (consume_reservation_hold).
  //
  // Corrección respecto de la corrida anterior: el torneo había perdido por
  // 'invalid_time' (la cancha de prueba no tenía horario propio configurado y
  // el slot pedido excedía el fallback duro de 09:00-22:30) — eso no prueba
  // NADA sobre protección de ocupación concurrente, así que no cuenta como
  // evidencia. Ahora el slot (09:00, 90 min -> termina 10:30) es válido bajo
  // ese mismo fallback, en una cancha/horario que ningún otro escenario de
  // este archivo toca.
  //
  // Un hold válido YA bloquea la cancha antes de convertirse (reservation_hold_conflict).
  // Después de convertirse, el bloqueo pasa a ser la reserva real (matches),
  // vía reservation_conflict. Se verifican EXPLÍCITAMENTE ambos estados
  // (3a, secuencial, sin ambigüedad de orden) y además la carrera real en
  // paralelo entre ambas operaciones (3b, con sincronización mediante
  // Promise.all sobre dos conexiones separadas) para confirmar que
  // lock_court_day ordena las dos transacciones sin permitir que las dos
  // lean el estado viejo a la vez.
  const SLOT3_TIME = "09:00";
  const SLOT3_DURATION = 90;

  // 3a) Estado "mientras existe el hold" -> reservation_hold_conflict.
  {
    const cSvcInsert = await asServiceClient();
    const rInsert = await cSvcInsert.query(holdRpcSql(P5, C2, DATE, SLOT3_TIME, SLOT3_DURATION));
    await cSvcInsert.end();
    log(rInsert.rows[0]?.ok === true, "3a-setup: se crea el hold válido antes de la carrera", JSON.stringify(rInsert.rows[0]));
    // insert_reservation_hold_locked genera su propio id (gen_random_uuid());
    // hay que usar el que devolvió, no inventar uno.
    const holdId = rInsert.rows[0]?.hold_id;

    const mF = "50000000-0000-0000-0000-000000000006";
    await newMatch(mF, 6);
    const cOwner = await asUserClient(OWNER);
    const rDuringHold = await cOwner.query(`select * from tournament_assign_match_slot('${mF}','${C2}','${DATE}','${SLOT3_TIME}')`);
    log(
      rDuringHold.rows[0]?.ok === false && rDuringHold.rows[0]?.reason === "reservation_hold_conflict",
      "3a: MIENTRAS el hold está pendiente y vigente, el torneo queda bloqueado por reservation_hold_conflict (no invalid_time)",
      JSON.stringify(rDuringHold.rows[0]),
    );

    // 3a continuación: se convierte el hold (secuencial, orden conocido) y se
    // repite el intento -> ahora el bloqueo es la reserva real (matches).
    const cSvcConsume = await asServiceClient();
    const rConsume = await cSvcConsume.query(`select * from consume_reservation_hold('${holdId}','mp-payment-sequential',5000)`);
    await cSvcConsume.end();
    log(rConsume.rows[0]?.ok === true && rConsume.rows[0]?.reason === "created", "3a: consume_reservation_hold convierte el hold en reserva real", JSON.stringify(rConsume.rows[0]));

    const rAfterConvert = await cOwner.query(`select * from tournament_assign_match_slot('${mF}','${C2}','${DATE}','${SLOT3_TIME}')`);
    await cOwner.end();
    log(
      rAfterConvert.rows[0]?.ok === false && rAfterConvert.rows[0]?.reason === "reservation_conflict",
      "3a: DESPUÉS de convertido, el torneo sigue bloqueado — ahora por reservation_conflict (matches), no por el hold que ya no existe",
      JSON.stringify(rAfterConvert.rows[0]),
    );
  }

  // 3b) Misma pareja de operaciones, ahora EN PARALELO real (dos conexiones,
  // Promise.all) sobre un slot fresco: valida que lock_court_day serializa
  // las dos transacciones sin importar cuál gane la carrera por el lock — en
  // CUALQUIER orden, el torneo nunca puede ganar mientras el hold exista o
  // acabe de convertirse en la misma transacción que lo bloqueó.
  {
    const SLOT3B_TIME = "11:00";
    const cSvcInsert2 = await asServiceClient();
    const rInsert2 = await cSvcInsert2.query(holdRpcSql(P5, C2, DATE, SLOT3B_TIME, SLOT3_DURATION));
    await cSvcInsert2.end();
    log(rInsert2.rows[0]?.ok === true, "3b-setup: se crea el segundo hold válido antes de la carrera paralela", JSON.stringify(rInsert2.rows[0]));
    const holdId2 = rInsert2.rows[0]?.hold_id;

    const mG = "50000000-0000-0000-0000-000000000007";
    await newMatch(mG, 7);
    const cOwner2 = await asUserClient(OWNER);
    const cSvcConsume2 = await asServiceClient();
    const [rTorneoRace, rConsumeRace] = await Promise.all([
      cOwner2.query(`select * from tournament_assign_match_slot('${mG}','${C2}','${DATE}','${SLOT3B_TIME}')`),
      cSvcConsume2.query(`select * from consume_reservation_hold('${holdId2}','mp-payment-race',5000)`),
    ]);
    await cOwner2.end();
    await cSvcConsume2.end();
    const torneoOk = rTorneoRace.rows[0]?.ok === true;
    const consumeOk = rConsumeRace.rows[0]?.ok === true && rConsumeRace.rows[0]?.reason === "created";
    log(torneoOk === false, "3b: en la carrera real en paralelo, el torneo NUNCA gana (ni por invalid_time: reason real de ocupación)", JSON.stringify(rTorneoRace.rows[0]));
    log(consumeOk === true, "3b: la conversión del hold siempre se completa igual, sin deadlock ni bloqueo cruzado", JSON.stringify(rConsumeRace.rows[0]));
    log(
      rTorneoRace.rows[0]?.reason === "reservation_hold_conflict" || rTorneoRace.rows[0]?.reason === "reservation_conflict",
      "3b: el reason del torneo es siempre un motivo de OCUPACIÓN real (hold o match), nunca invalid_time ni otro error ajeno a la carrera",
      JSON.stringify(rTorneoRace.rows[0]),
    );
  }

  await admin.end();
  console.log(failures === 0 ? "\nALL CONCURRENCY CHECKS PASSED" : `\n${failures} CONCURRENCY CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
