import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Tripwire estático (mismo criterio que fixed-slot-hold-exclusion.test.ts):
 * no monta un mock de Supabase/RLS real, lee el código fuente y verifica que
 * el patrón "auth con sesión -> validar ownership -> recién ahí service role"
 * siga presente. Cubre la regresión real de producción: "Cancelar reserva" y
 * "Reembolsar" quedaban en éxito silencioso porque el UPDATE de matches y el
 * SELECT de payments corrían con el cliente de sesión del club, bloqueados
 * por RLS (matches.owner_id = auth.uid() del JUGADOR, payments.user_id =
 * auth.uid() del JUGADOR) sin devolver error.
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
  // corta en el próximo "export async function" o "export function" al mismo nivel
  const rest = source.slice(start + marker.length);
  const nextExportIdx = rest.search(/\n(export async function|export function|export type)/);
  return nextExportIdx === -1 ? rest : rest.slice(0, nextExportIdx);
}

describe("cancelReservationAdmin usa service role recién después de validar ownership", () => {
  const source = readRepoFile(RESERVAS_ACTIONS_PATH);
  const fn = extractFunction(source, "cancelReservationAdmin");

  it("valida ownership (ctx.courtIds) antes de crear el service client", () => {
    const ownershipIdx = fn.indexOf("ctx.courtIds.includes");
    const serviceIdx = fn.indexOf("createServiceClient()");
    assert.notEqual(ownershipIdx, -1, "falta el chequeo de ownership");
    assert.notEqual(serviceIdx, -1, "falta la elevación a service role");
    assert.ok(ownershipIdx < serviceIdx, "el ownership debe validarse ANTES de elevar a service role");
  });

  it("el UPDATE de matches corre con el service client, no con el de sesión", () => {
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

describe("requestReservationRefundAction usa service role recién después de validar ownership", () => {
  const source = readRepoFile(RESERVAS_ACTIONS_PATH);
  const fn = extractFunction(source, "requestReservationRefundAction");

  it("valida ownership (ctx.courtIds) antes de crear el service client", () => {
    const ownershipIdx = fn.indexOf("ctx.courtIds.includes");
    const serviceIdx = fn.indexOf("createServiceClient()");
    assert.notEqual(ownershipIdx, -1, "falta el chequeo de ownership");
    assert.notEqual(serviceIdx, -1, "falta la elevación a service role");
    assert.ok(ownershipIdx < serviceIdx, "el ownership debe validarse ANTES de elevar a service role");
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

describe("processRefundRequestAction (finanzas/reembolsos) usa el mismo patrón seguro", () => {
  const source = readRepoFile(REEMBOLSOS_ACTIONS_PATH);
  const fn = extractFunction(source, "processRefundRequestAction");

  it("importa createServiceClient", () => {
    assert.match(source, /import \{ createClient, createServiceClient \} from "@\/utils\/supabase\/server"/);
  });

  it("valida ownership antes de crear el service client", () => {
    const ownershipIdx = fn.indexOf("ctx.courtIds.includes");
    const serviceIdx = fn.indexOf("createServiceClient()");
    assert.notEqual(ownershipIdx, -1, "falta el chequeo de ownership");
    assert.notEqual(serviceIdx, -1, "falta la elevación a service role");
    assert.ok(ownershipIdx < serviceIdx, "el ownership debe validarse ANTES de elevar a service role");
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
