import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * refundReservationPayment debe poder reconciliar el match cuando
 * `payments.status` ya quedó en "refunded" (de un intento anterior) pero
 * `matches.payment_status` no se sincronizó — sin volver a tocar Mercado
 * Pago. Esta rama del código (la del "alreadyRefundedRow" en
 * lib/payment-refund.ts) retorna ANTES de siquiera llamar a
 * refundApprovedPayment, así que no necesita mockear lib/mercadopago.ts: si
 * el código llegara a invocarlo por error, con un token/payment_id falsos
 * intentaría una llamada de red real y este test fallaría/colgaría, lo que
 * ya actúa como detector.
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

class FakeUpdateBuilder implements PromiseLike<{ error: unknown }> {
  private filters: Filter[] = [];
  private rows: Row[];
  private patch: Row;
  constructor(rows: Row[], patch: Row) {
    this.rows = rows;
    this.patch = patch;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ col, val, op: "eq" });
    return this;
  }
  private exec(): { error: unknown } {
    for (const r of this.rows) {
      if (rowMatches(r, this.filters)) Object.assign(r, this.patch);
    }
    return { error: null };
  }
  then<T1 = { error: unknown }, T2 = never>(
    onfulfilled?: ((value: { error: unknown }) => T1 | PromiseLike<T1>) | null,
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

const MATCH_ID = "match-1";
const PAYMENT_ID = "payment-1";

describe("Idempotencia CROSS-REQUEST — reconciliación a nivel match sin tocar MP", () => {
  it("refundReservationPayment reconcilia el match cuando payments ya quedó 'refunded' de un intento anterior", async () => {
    const { refundReservationPayment } = await import("../payment-refund");

    const admin = new FakeAdmin();
    admin.seed("matches", [
      { id: MATCH_ID, payment_status: "paid", financial_status: "partially_paid", total_price: 50000 },
    ]);
    admin.seed("payments", [
      { id: PAYMENT_ID, match_id: MATCH_ID, status: "refunded", mp_payment_id: "mp-real-1", payment_method: "mercadopago" },
    ]);

    const outcome = await refundReservationPayment(admin.asClient(), MATCH_ID);

    assert.deepEqual(outcome, { kind: "refunded" });
    assert.equal(admin.tables.matches[0].payment_status, "refunded");
    assert.equal(admin.tables.matches[0].financial_status, "unpaid");
    assert.equal(admin.tables.matches[0].amount_paid, 0);
  });
});
