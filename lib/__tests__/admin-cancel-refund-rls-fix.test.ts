import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Tripwire estático (mismo criterio que fixed-slot-hold-exclusion.test.ts):
 * no monta un mock de Supabase/RLS real, lee el código fuente y verifica que
 * el patrón "auth con sesión -> LEER el match con service role -> recién ahí
 * validar ownership por ctx.courtIds -> reusar ese service role para
 * refund/update" siga presente.
 *
 * Cubre dos bugs reales de producción encadenados:
 * 1. El UPDATE de matches y el SELECT de payments con el cliente de sesión
 *    del club quedaban bloqueados por RLS (matches.owner_id / payments.user_id
 *    = el JUGADOR, no el club) sin devolver error -> "éxito" silencioso.
 * 2. Incluso el SELECT inicial de matches (para decidir si la reserva
 *    pertenece al club) usaba el cliente de sesión y podía no encontrar la
 *    fila, abortando el flujo como si la reserva no existiera.
 *
 * La autorización real NUNCA se relaja: sigue siendo ctx.courtIds (derivado
 * de clubs.owner_id = auth.uid() del club logueado, con el cliente de
 * sesión normal) quien decide si el club puede operar sobre ese match. El
 * service role solo se usa para LEER/ESCRIBIR después de esa validación.
 */

const RESERVAS_ACTIONS_PATH = "app/admin/reservas/actions.ts";
const REEMBOLSOS_ACTIONS_PATH = "app/admin/finanzas/reembolsos/actions.ts";
const PAYMENT_REFUND_PATH = "lib/payment-refund.ts";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf-8");
}

function extractFunction(source: string, name: string): string {
  const marker = `export async function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `no se encontró la función ${name}`);
  const rest = source.slice(start + marker.length);
  const nextExportIdx = rest.search(/\n(export async function|export function|export type)/);
  return nextExportIdx === -1 ? rest : rest.slice(0, nextExportIdx);
}

function assertReadWithServiceThenOwnership(fn: string, label: string) {
  const authIdx = fn.search(/ctx\?\.userId\)/);
  const serviceIdx = fn.indexOf("createServiceClient()");
  const serviceSelectIdx = fn.search(/service\s*\n?\s*\.from\(DB_TABLES\.matches\)\s*\n?\s*\.select\(/);
  const ownershipIdx = fn.indexOf("ctx.courtIds.includes");

  assert.notEqual(authIdx, -1, `${label}: falta el chequeo de auth (ctx?.userId)`);
  assert.notEqual(serviceIdx, -1, `${label}: falta la elevación a service role`);
  assert.notEqual(serviceSelectIdx, -1, `${label}: el SELECT inicial de matches debe correr con el service client`);
  assert.notEqual(ownershipIdx, -1, `${label}: falta el chequeo de ownership (ctx.courtIds)`);

  assert.ok(authIdx < serviceIdx, `${label}: la auth debe validarse antes de crear el service client`);
  assert.ok(
    serviceIdx <= serviceSelectIdx,
    `${label}: el service client debe crearse antes (o junto a) el SELECT de matches`
  );
  assert.ok(
    serviceSelectIdx < ownershipIdx,
    `${label}: ownership (ctx.courtIds) debe validarse DESPUÉS de leer la fila con service role, no antes`
  );

  // El SELECT con el cliente de sesión sin privilegios (`supabase`, no
  // `service`) para leer el match objetivo ya no debe existir: es el patrón
  // que quedaba en null silencioso por RLS.
  assert.doesNotMatch(
    fn,
    /(?<!ctx = await getOwnerAdminContext\()\bsupabase\s*\n?\s*\.from\(DB_TABLES\.matches\)\s*\n?\s*\.select\("id,court_id/,
    `${label}: no debe quedar un SELECT de matches con el cliente de sesión sin privilegios`
  );
}

describe("cancelReservationAdmin: lee el match con service role y valida ownership después", () => {
  const source = readRepoFile(RESERVAS_ACTIONS_PATH);
  const fn = extractFunction(source, "cancelReservationAdmin");

  it("sigue el patrón auth -> service role -> lectura -> ownership", () => {
    assertReadWithServiceThenOwnership(fn, "cancelReservationAdmin");
  });

  it("el UPDATE de matches corre con el service client (reutilizado)", () => {
    assert.match(
      fn,
      /service\s*\n?\s*\.from\(DB_TABLES\.matches\)\s*\.update\(\{ match_status: "cancelled" \}\)/
    );
  });

  it("comprueba explícitamente que el UPDATE afectó alguna fila (no success silencioso)", () => {
    assert.match(fn, /\.select\("id"\)/);
    assert.match(fn, /updatedRows\.length === 0/);
  });
});

describe("requestReservationRefundAction: lee el match con service role y valida ownership después", () => {
  const source = readRepoFile(RESERVAS_ACTIONS_PATH);
  const fn = extractFunction(source, "requestReservationRefundAction");

  it("sigue el patrón auth -> service role -> lectura -> ownership", () => {
    assertReadWithServiceThenOwnership(fn, "requestReservationRefundAction");
  });

  it("refundReservationPayment recibe el service client, no el de sesión", () => {
    assert.match(fn, /refundReservationPayment\(service, matchId\)/);
    assert.doesNotMatch(fn, /refundReservationPayment\(supabase, matchId\)/);
  });

  it("el UPDATE de cancelación post-reembolso corre con service client y valida filas afectadas", () => {
    assert.match(fn, /service\s*\n?\s*\.from\(DB_TABLES\.matches\)\s*\.update\(\{ match_status: "cancelled" \}\)/);
    assert.match(fn, /updatedRows\.length === 0/);
  });
});

describe("processRefundRequestAction (finanzas/reembolsos): mismo patrón seguro", () => {
  const source = readRepoFile(REEMBOLSOS_ACTIONS_PATH);
  const fn = extractFunction(source, "processRefundRequestAction");

  it("importa createServiceClient", () => {
    assert.match(source, /import \{ createClient, createServiceClient \} from "@\/utils\/supabase\/server"/);
  });

  it("sigue el patrón auth -> service role -> lectura -> ownership", () => {
    assertReadWithServiceThenOwnership(fn, "processRefundRequestAction");
  });

  it("refundReservationPayment recibe el service client, no el de sesión", () => {
    assert.match(fn, /refundReservationPayment\(service, matchId\)/);
    assert.doesNotMatch(fn, /refundReservationPayment\(supabase, matchId\)/);
  });
});

describe("lib/payment-refund.ts no fue reescrito (solo cambian los callers)", () => {
  const source = readRepoFile(PAYMENT_REFUND_PATH);

  it("sigue sin llamar a Mercado Pago fuera de refundMercadoPagoPayment", () => {
    assert.match(source, /refundMercadoPagoPayment\(mpId, clubAccessToken\)/);
  });

  it("sigue recibiendo un SupabaseClient genérico (el caller decide el nivel de privilegio)", () => {
    assert.match(source, /admin: SupabaseClient/);
  });
});
