// Pruebas de seguridad de 20260929100000_profiles_protected_columns.sql (ya
// aplicada en producción) + 20260930100000_profiles_phone_self_declared.sql.
//
// Reproduce en PGlite (Postgres embebido, descartable) el estado REAL de
// public.profiles en producción, leído el 2026-09-24: columnas, políticas
// RLS, grants de tabla completa a anon/authenticated y el trigger
// handle_new_user. Emula auth.uid() con request.jwt.claim.sub, como
// PostgREST. Nunca se conecta a producción.
//
// PGlite no es dependencia del repo. Ejecutar con:
//   PGLITE_MODULE=<ruta a @electric-sql/pglite/dist/index.js> \
//     node test/security/profiles-protected-columns.pglite.mjs

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

let PGlite;
try {
  const spec = process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : "@electric-sql/pglite";
  ({ PGlite } = await import(spec));
} catch {
  console.log("SKIP: falta @electric-sql/pglite (definí PGLITE_MODULE).");
  process.exit(0);
}

const MIGRATION_PROTECTED = new URL("../../supabase/migrations/20260929100000_profiles_protected_columns.sql", import.meta.url);
const MIGRATION_SELF_DECLARED = new URL("../../supabase/migrations/20260930100000_profiles_phone_self_declared.sql", import.meta.url);

const U = {
  unverified: "00000000-0000-0000-0000-00000000000a",
  verified: "00000000-0000-0000-0000-00000000000b",
  legacy: "00000000-0000-0000-0000-00000000000c",
  pending: "00000000-0000-0000-0000-00000000000d",
  fresh: "00000000-0000-0000-0000-00000000000e",
};

const PROD_SCHEMA = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  grant usage on schema public, auth to anon, authenticated, service_role;

  create table auth.users (
    id uuid primary key,
    phone text,
    phone_confirmed_at timestamptz,
    phone_change text default '',
    raw_user_meta_data jsonb default '{}'
  );
  create unique index users_phone_key on auth.users (phone);

  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

  create table public.profiles (
    id uuid not null default auth.uid() primary key,
    name text, created_at timestamp default now(), user_id uuid,
    matches_played integer default 0, wins integer default 0, avatar_url text,
    is_leveled boolean default false, calculated_category text, preferred_hand text,
    court_position text, preferred_schedule text, technical_score real, level_of_play text,
    base_level text, category text, age integer, description text, bio text,
    level double precision, gender text, location text,
    notifications_enabled boolean default true, is_public boolean default true,
    onboarding_completed boolean default false,
    is_globally_blocked boolean not null default false,
    slides_seen boolean default false, onesignal_player_id text,
    country text default 'Argentina', province text, city text, phone text
  );
  alter table public.profiles enable row level security;

  create policy "Los usuarios pueden editar su propio perfil" on public.profiles for update using (auth.uid() = id);
  create policy "Los usuarios pueden ver su propio perfil" on public.profiles for select using (auth.uid() = id);
  create policy "Perfiles públicos son visibles" on public.profiles for select using (true);
  create policy "Perfiles visibles" on public.profiles for select using (true);
  create policy "Usuarios pueden editar su propio perfil" on public.profiles for update using (auth.uid() = id);
  create policy profiles_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
  create policy profiles_read_own on public.profiles for select using (auth.uid() = user_id);
  create policy profiles_update on public.profiles for update to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  create policy profiles_update_own on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

  grant all on public.profiles to anon, authenticated, service_role;

  create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
  begin
    insert into public.profiles (id, user_id, name, level)
    values (new.id, new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Jugador Nuevo'), 1)
    on conflict (id) do nothing;
    return new;
  exception when others then return new;
  end; $$;
  create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
`;

const db = new PGlite();
await db.exec(PROD_SCHEMA);

await db.exec(`
  insert into auth.users (id, phone, phone_confirmed_at, phone_change) values
    ('${U.unverified}', null, null, ''),
    ('${U.verified}', '5493411234567', now(), ''),
    ('${U.legacy}', null, null, ''),
    ('${U.pending}', null, null, '5493417654321');
  update public.profiles set onboarding_completed = true, phone = '341 555-0000', name = 'Legacy', category = '6ta'
    where user_id = '${U.legacy}';
`);

async function as(role, uid, sql, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

async function expectError(promise, pattern) {
  try {
    await promise;
  } catch (e) {
    assert.match(String(e.message), pattern);
    return e.message;
  }
  assert.fail(`se esperaba error ${pattern}`);
}

const profile = async (uid) =>
  (await db.query("select * from public.profiles where user_id = $1", [uid])).rows[0];

const results = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push(["OK", name, detail ?? ""]);
  } catch (e) {
    results.push(["FALLA", name, e.message]);
  }
}

// ── Antes de las migraciones: reproducir la vulnerabilidad ─────────────────
await check("PRE: sin migración un UPDATE directo de onboarding_completed pasa", async () => {
  const r = await as("authenticated", U.unverified,
    "update public.profiles set onboarding_completed = true where user_id = $1", [U.unverified]);
  assert.equal(r.affectedRows, 1);
  await db.query("update public.profiles set onboarding_completed = false where user_id = $1", [U.unverified]);
  return "vulnerable (esperado)";
});

const legacyBefore = await profile(U.legacy);
const countBefore = (await db.query("select count(*)::int n from public.profiles")).rows[0].n;
const authBefore = (await db.query("select * from auth.users order by id")).rows;

// Orden real de producción: la primera ya está aplicada, la segunda es la nueva.
await db.exec(readFileSync(MIGRATION_PROTECTED, "utf8"));

await check("Estado intermedio (solo la migración aplicada en prod): la RPC exige OTP", () =>
  expectError(as("authenticated", U.unverified,
    "select public.complete_player_onboarding('x',null,'masculino',null,'derecha','drive','noche','6ta','Santa Fe',null)"),
    /phone_not_verified/));

await db.exec(readFileSync(MIGRATION_SELF_DECLARED, "utf8"));

// ── Después de ambas migraciones ───────────────────────────────────────────
await check("UPDATE directo onboarding_completed = true", () =>
  expectError(as("authenticated", U.unverified,
    "update public.profiles set onboarding_completed = true where user_id = $1", [U.unverified]), /permission denied/));

await check("UPDATE directo de phone", () =>
  expectError(as("authenticated", U.unverified,
    "update public.profiles set phone = '+5491122334455' where user_id = $1", [U.unverified]), /permission denied/));

await check("UPDATE directo is_globally_blocked = false", () =>
  expectError(as("authenticated", U.unverified,
    "update public.profiles set is_globally_blocked = false where user_id = $1", [U.unverified]), /permission denied/));

await check("UPDATE directo de user_id (apropiarse de otra cuenta)", () =>
  expectError(as("authenticated", U.unverified,
    "update public.profiles set user_id = $2 where id = $1", [U.unverified, U.verified]), /permission denied/));

await check("INSERT con onboarding_completed / phone", () =>
  expectError(as("authenticated", U.unverified,
    "insert into public.profiles (id, user_id, name, onboarding_completed, phone) values (gen_random_uuid(), $1, 'x', true, '+1')",
    [U.unverified]), /permission denied/));

await check("La firma anterior (OTP, 10 parámetros) ya no existe", () =>
  expectError(as("authenticated", U.unverified,
    "select public.complete_player_onboarding('x',null,'masculino',null,'derecha','drive','noche','6ta','Santa Fe',null)"),
    /does not exist/));

await check("anon no puede escribir ni llamar las RPC", async () => {
  await expectError(as("anon", null, "update public.profiles set name = 'x'"), /permission denied/);
  await expectError(as("anon", null,
    "select public.complete_player_onboarding('x',null,'masculino',null,'derecha','drive','noche','6ta','+5491122334455','Santa Fe',null)"),
    /permission denied/);
  await expectError(as("anon", null, "select public.update_my_phone('+5491122334455')"), /permission denied/);
});

await check("authenticated sin JWT (auth.uid() nulo) es rechazado", () =>
  expectError(as("authenticated", null, "select public.update_my_phone('+5491122334455')"), /not_authenticated/));

const RPC =
  "select public.complete_player_onboarding($1, 30, 'masculino', null, 'derecha', 'drive', 'noche', '6ta', $2, 'Santa Fe', 'Rosario') as phone";

await check("Teléfonos inválidos rechazados por la RPC (sin tocar la fila)", async () => {
  for (const bad of [null, "", "1122334455", "5491122334455", "+541122334455", "+14155552671",
    "+54911223344556", "+5491111111111", "+5493410000000", "+5491122334455' or 1=1 --"]) {
    await expectError(as("authenticated", U.unverified, RPC, ["Ana", bad]), /invalid_phone/);
  }
  const p = await profile(U.unverified);
  assert.equal(p.onboarding_completed, false);
  assert.equal(p.phone, null);
});

await check("RPC valida campos (categoría inválida)", () =>
  expectError(as("authenticated", U.unverified,
    "select public.complete_player_onboarding('x',null,'masculino',null,'derecha','drive','noche','9na','+5491122334455','Santa Fe',null)"),
    /invalid_profile/));

await check("Onboarding legítimo SIN OTP (sin teléfono en Auth)", async () => {
  const r = await as("authenticated", U.unverified, RPC, ["Ana", "+5491122334455"]);
  assert.equal(r.rows[0].phone, "+5491122334455");
  const p = await profile(U.unverified);
  assert.equal(p.onboarding_completed, true);
  assert.equal(p.phone, "+5491122334455");
  assert.equal(p.name, "Ana");
  assert.equal(p.city, "Rosario");
  assert.equal(p.is_globally_blocked, false);
  return `phone=${p.phone} (declarado)`;
});

await check("Cuenta con OTP previo: guarda el número declarado, Auth no cambia", async () => {
  await as("authenticated", U.verified, RPC, ["Beto", "+5493416789012"]);
  assert.equal((await profile(U.verified)).phone, "+5493416789012");
  const a = (await db.query("select phone from auth.users where id = $1", [U.verified])).rows[0];
  assert.equal(a.phone, "5493411234567");
});

await check("Onboarding repetido rechazado", () =>
  expectError(as("authenticated", U.unverified, RPC, ["Ana 2", "+5491122334456"]), /onboarding_unavailable/));

await check("La RPC solo toca la fila propia", async () => {
  const other = await profile(U.pending);
  assert.equal(other.onboarding_completed, false);
  assert.equal(other.phone, null);
  assert.equal(other.name, "Jugador Nuevo");
});

await check("No se puede editar el perfil de otra cuenta", async () => {
  const r = await as("authenticated", U.pending,
    "update public.profiles set name = 'hackeado' where user_id = $1", [U.verified]);
  assert.equal(r.affectedRows, 0);
  assert.equal((await profile(U.verified)).name, "Beto");
});

await check("update_my_phone: corrige solo el teléfono propio", async () => {
  const before = await profile(U.unverified);
  const otherBefore = await profile(U.verified);
  const r = await as("authenticated", U.unverified, "select public.update_my_phone($1) as phone", ["+5492944123456"]);
  assert.equal(r.rows[0].phone, "+5492944123456");
  const after = await profile(U.unverified);
  assert.deepEqual({ ...after, phone: before.phone }, before);
  assert.equal(after.phone, "+5492944123456");
  assert.deepEqual(await profile(U.verified), otherBefore);
});

await check("update_my_phone: formato inválido rechazado", async () => {
  await expectError(as("authenticated", U.unverified, "select public.update_my_phone('2944123456')"), /invalid_phone/);
  await expectError(as("authenticated", U.unverified, "select public.update_my_phone('+5492940000000')"), /invalid_phone/);
  assert.equal((await profile(U.unverified)).phone, "+5492944123456");
});

await check("update_my_phone: no sirve antes del onboarding", async () => {
  await expectError(as("authenticated", U.pending, "select public.update_my_phone('+5491122334455')"), /profile_unavailable/);
  assert.equal((await profile(U.pending)).phone, null);
});

await check("update_my_phone: no desbloquea a un jugador bloqueado", async () => {
  await as("service_role", null, "update public.profiles set is_globally_blocked = true where user_id = $1", [U.unverified]);
  await as("authenticated", U.unverified, "select public.update_my_phone('+5491122334455')");
  const p = await profile(U.unverified);
  assert.equal(p.is_globally_blocked, true);
  assert.equal(p.phone, "+5491122334455");
  await db.query("update public.profiles set is_globally_blocked = false where user_id = $1", [U.unverified]);
});

await check("Ninguna RPC toca auth.users (no marca phone_confirmed_at)", async () => {
  const now = (await db.query("select * from auth.users where id = any($1) order by id",
    [authBefore.map((u) => u.id)])).rows;
  assert.deepEqual(now, authBefore);
});

await check("Edición legítima de campos no protegidos", async () => {
  const r = await as("authenticated", U.pending,
    `update public.profiles set name = 'Pato', age = 28, bio = 'hola', gender = 'femenino', avatar_url = 'https://x/a.png',
       preferred_hand = 'zurda', court_position = 'reves', preferred_schedule = 'tarde', category = '7ma',
       country = 'Argentina', province = 'Santa Fe', city = 'Rosario', location = 'Rosario, Santa Fe',
       notifications_enabled = false, is_public = false, slides_seen = true, onesignal_player_id = 'tok'
     where user_id = $1`, [U.pending]);
  assert.equal(r.affectedRows, 1);
  const p = await profile(U.pending);
  assert.equal(p.name, "Pato");
  assert.equal(p.onboarding_completed, false);
});

await check("Alta de fila propia (ensureProfileRowExists) sigue funcionando", async () => {
  await db.query("insert into auth.users (id) values ($1)", [U.fresh]);
  await db.query("delete from public.profiles where user_id = $1", [U.fresh]);
  const r = await as("authenticated", U.fresh,
    "insert into public.profiles (user_id, name) values ($1, 'Nuevo')", [U.fresh]);
  assert.equal(r.affectedRows, 1);
  assert.equal((await profile(U.fresh)).onboarding_completed, false);
});

await check("handle_new_user (trigger de alta) sigue creando perfiles", async () => {
  const id = "00000000-0000-0000-0000-0000000000ff";
  await db.query("insert into auth.users (id, raw_user_meta_data) values ($1, '{\"full_name\":\"Trigger\"}')", [id]);
  assert.equal((await profile(id)).name, "Trigger");
});

await check("service_role (superadmin) sigue pudiendo bloquear", async () => {
  const r = await as("service_role", null,
    "update public.profiles set is_globally_blocked = true where user_id = $1", [U.fresh]);
  assert.equal(r.affectedRows, 1);
});

await check("Usuarios históricos conservados", async () => {
  const after = await profile(U.legacy);
  assert.deepEqual(after, legacyBefore);
  return `legacy: onboarding=${after.onboarding_completed}, phone='${after.phone}' intactos; filas previas=${countBefore}`;
});

await check("Usuario histórico puede corregir su teléfono", async () => {
  await as("authenticated", U.legacy, "select public.update_my_phone('+5493415550001')");
  const p = await profile(U.legacy);
  assert.equal(p.phone, "+5493415550001");
  assert.equal(p.onboarding_completed, true);
  assert.equal(p.name, "Legacy");
});

for (const [status, name, detail] of results) console.log(`${status.padEnd(5)} ${name}${detail ? `  → ${detail}` : ""}`);
const failed = results.filter(([s]) => s !== "OK").length;
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);
