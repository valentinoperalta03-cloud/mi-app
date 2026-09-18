import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Un payment que aparece en "refund_requested" sin que ESTE request haya
 * ganado el claim atómico (perdió una carrera, o quedó de un intento previo
 * cortado) NUNCA debe disparar un POST /refunds si no se puede confirmar
 * contra MP que el estado real es "refunded". Si el GET a MP falla (red,
 * token, lo que sea), el resultado debe ser fail-closed: cero llamadas a
 * refundMercadoPagoPayment.
 *
 * Requiere `node --experimental-test-module-mocks`. Un solo mock.module por
 * archivo (ver refund-idempotency-concurrent-claim.test.ts para el porqué).
 */

type Row = Record<string, unknown>;
type Filter = { col: string; val: unknown; op: "eq" | "in" };

function rowMatches(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => (f.op === "in" ? (f.val as unknown[]).includes(row[f.col]) : row[f.col] === f.val));
}

class FakeSelectBuilder {
  private filters: Filter[] = [];
  private rows: Row[];
  constructor(rows: Row[]) {
    this.rows = rows;
  }
  select(_cols?: string) {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ col, val, op: "eq" });
    return this;
  }
  in(col: string, val: unknown[]) {
    this.filters.push({ col, val, op: "in" });
    return this;
  }
  async maybeSingle() {
    return { data: this.rows.find((r) => rowMatches(r, this.filters)) ?? null };
  }
}

class FakeUpdateBuilder implements PromiseLike<{ data: Row[] | null; error: unknown }> {
  private filters: Filter[] = [];
  private rows: Row[];
  private patch: Row;
  private wantsData = false;
  constructor(rows: Row[], patch: Row) {
    this.rows = rows;
    this.patch = patch;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ col, val, op: "eq" });
    return this;
  }
  select(_cols?: string) {
    this.wantsData = true;
    return this;
  }
  private exec(): { data: Row[] | null; error: unknown } {
    const matched = this.rows.filter((r) => rowMatches(r, this.filters));
    for (const r of matched) Object.assign(r, this.patch);
    return { data: this.wantsData ? matched.map((r) => ({ ...r })) : null, error: null };
  }
  then<T1 = { data: Row[] | null; error: unknown }, T2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; error: unknown }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.exec()).then(onfulfilled, onrejected);
  }
}

class FakeAdmin {
  tables: Record<string, Row[]> = {};
  seed(table: string, rows: Row[]) {
    this.tables[table] = rows;
    return this;
  }
  from(table: string) {
    if (!this.tables[table]) this.tables[table] = [];
    const rows = this.tables[table];
    return {
      select: (cols?: string) => new FakeSelectBuilder(rows).select(cols),
      update: (patch: Row) => new FakeUpdateBuilder(rows, patch),
    };
  }
  asClient(): SupabaseClient {
    return this as unknown as SupabaseClient;
  }
}

const CLUB_ID = "club-1";
const COURT_ID = "court-1";
const MATCH_ID = "match-1";
const PAYMENT_ID = "payment-1";
const MP_PAYMENT_ID = "mp-real-178397809431";

function seededAdmin(): FakeAdmin {
  const admin = new FakeAdmin();
  admin.seed("clubs", [{ id: CLUB_ID, mp_access_token: "club-token" }]);
  admin.seed("courts", [{ id: COURT_ID, club_id: CLUB_ID }]);
  admin.seed("matches", [
    { id: MATCH_ID, court_id: COURT_ID, payment_status: "paid", financial_status: "partially_paid", total_price: 50000 },
  ]);
  admin.seed("payments", [
    // Arranca en "refund_requested": simula haber perdido el claim atómico
    // (o un intento previo que se cortó) — NINGÚN request en curso lo ganó
    // desde el punto de vista de esta llamada.
    { id: PAYMENT_ID, match_id: MATCH_ID, status: "refund_requested", mp_payment_id: MP_PAYMENT_ID, payment_method: "mercadopago" },
  ]);
  return admin;
}

describe("Idempotencia CROSS-REQUEST — fail closed si el GET a MP falla", () => {
  it("payment en 'refund_requested' + GET a MP falla => refundCallCount === 0", async (t) => {
    let refundCallCount = 0;
    let statusCallCount = 0;

    t.mock.module("../mercadopago", {
      namedExports: {
        refundMercadoPagoPayment: async () => {
          refundCallCount += 1;
          return { ok: true };
        },
        // GET incierto: red caída, token vencido, lo que sea.
        getMercadoPagoPaymentStatus: async () => {
          statusCallCount += 1;
          return null;
        },
      },
    });

    const { refundApprovedPayment } = await import("../payment-refund");

    const admin = seededAdmin();
    const outcome = await refundApprovedPayment(admin.asClient(), PAYMENT_ID);

    assert.equal(outcome.kind, "failed");
    assert.equal(refundCallCount, 0, "un GET incierto NUNCA debe habilitar un POST /refunds a ciegas");
    assert.equal(statusCallCount, 1, "sí se intentó verificar contra MP antes de decidir");
    assert.equal(admin.tables.payments[0].status, "refund_requested", "la fila no se toca ante un estado incierto");
  });
});
