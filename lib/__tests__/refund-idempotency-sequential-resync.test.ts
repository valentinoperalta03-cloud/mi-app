import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Retry SECUENCIAL (no concurrente): llamada 1 tiene éxito en MP pero falla
 * al persistir localmente (refunded_unsynced, la fila queda en
 * "refund_requested" por el claim atómico). Una llamada 2 independiente,
 * sobre la misma fila desincronizada, debe reconciliar consultando el estado
 * real en MP — SIN volver a llamar a refundMercadoPagoPayment.
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
  private failWith: unknown;
  private wantsData = false;
  constructor(rows: Row[], patch: Row, failWith: unknown) {
    this.rows = rows;
    this.patch = patch;
    this.failWith = failWith;
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
    if (this.failWith) return { data: null, error: this.failWith };
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
  /** Falla solo el UPDATE cuyo patch matchea el predicado (ej. solo "-> refunded", no el claim "-> refund_requested"). */
  failUpdateWhen: ((table: string, patch: Row) => boolean) | null = null;
  seed(table: string, rows: Row[]) {
    this.tables[table] = rows;
    return this;
  }
  from(table: string) {
    if (!this.tables[table]) this.tables[table] = [];
    const rows = this.tables[table];
    return {
      select: (cols?: string) => new FakeSelectBuilder(rows).select(cols),
      update: (patch: Row) => {
        const shouldFail = Boolean(this.failUpdateWhen?.(table, patch));
        return new FakeUpdateBuilder(rows, patch, shouldFail ? new Error(`simulated db error on ${table}`) : null);
      },
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
    { id: PAYMENT_ID, match_id: MATCH_ID, status: "approved", mp_payment_id: MP_PAYMENT_ID, payment_method: "mercadopago" },
  ]);
  return admin;
}

describe("Idempotencia CROSS-REQUEST — retry secuencial tras refunded_unsynced", () => {
  it("llamada 1: MP success + DB sync failure => refunded_unsynced. Llamada 2 independiente: reconcilia SIN volver a llamar a MP", async (t) => {
    let refundCallCount = 0;
    let mpSideAlreadyRefunded = false;

    t.mock.module("../mercadopago", {
      namedExports: {
        refundMercadoPagoPayment: async (mpPaymentId: string) => {
          refundCallCount += 1;
          assert.equal(mpPaymentId, MP_PAYMENT_ID);
          mpSideAlreadyRefunded = true;
          return { ok: true };
        },
        getMercadoPagoPaymentStatus: async () => (mpSideAlreadyRefunded ? "refunded" : "approved"),
      },
    });

    const { refundApprovedPayment } = await import("../payment-refund");

    // Llamada 1: el claim (approved -> refund_requested) funciona, pero el
    // UPDATE final (-> refunded) tras el éxito en MP falla.
    const admin1 = seededAdmin();
    admin1.failUpdateWhen = (table, patch) => table === "payments" && patch.status === "refunded";
    const outcome1 = await refundApprovedPayment(admin1.asClient(), PAYMENT_ID);
    assert.equal(outcome1.kind, "refunded_unsynced");
    assert.equal(refundCallCount, 1);
    assert.equal(admin1.tables.payments[0].status, "refund_requested");

    // Llamada 2: request independiente, misma fila (quedó en
    // "refund_requested"), DB ya sana. Debe reconciliar consultando MP, sin
    // volver a llamar a refundMercadoPagoPayment.
    const admin2 = seededAdmin();
    admin2.tables.payments[0].status = "refund_requested";
    const outcome2 = await refundApprovedPayment(admin2.asClient(), PAYMENT_ID);

    assert.deepEqual(outcome2, { kind: "refunded" });
    assert.equal(admin2.tables.payments[0].status, "refunded");
    assert.equal(refundCallCount, 1, "un segundo intento NO dispara un segundo refund real contra MP");
  });
});
