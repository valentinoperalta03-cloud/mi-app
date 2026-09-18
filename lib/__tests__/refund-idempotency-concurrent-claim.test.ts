import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cubre la carrera concurrente sobre un refund: dos requests que leen el
 * MISMO payment "approved" antes de que cualquiera de los dos escriba nada.
 * Sin un claim atómico en DB, correctness dependería de que Mercado Pago
 * honre la idempotency key determinística en /refunds — comportamiento que
 * no se pudo verificar contra la API real, así que no se asume. La garantía
 * real es el UPDATE condicionado `WHERE status = 'approved'` en
 * refundApprovedPayment: solo el request que efectivamente afecta 1 fila
 * puede seguir hasta el POST /refunds; el resto nunca llama a MP a ciegas.
 *
 * Requiere `node --experimental-test-module-mocks`.
 *
 * UN SOLO archivo con UNA SOLA configuración de mock.module: cada archivo de
 * test corre en su propio proceso de `node --test`, pero DENTRO de un mismo
 * proceso un módulo importado una vez queda cacheado para siempre — un
 * segundo `t.mock.module` sobre la misma dependencia en otro `it()` del
 * mismo archivo NO reintercepta las bindings ya resueltas dentro de
 * lib/payment-refund.ts (que solo se evalúa una vez). Por eso cada escenario
 * de idempotencia vive en su propio archivo .test.ts.
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

/**
 * Modela el UPDATE condicionado de Postgres (`WHERE id = ? AND status = ?`)
 * de forma fiel a lo que importa para este test: `exec()` corre entero de
 * forma síncrona (filtra Y muta en el mismo paso, sin ningún `await` en el
 * medio), así que en un `Promise.all` de dos llamadas sobre el MISMO array
 * de filas, quien primero llegue a ejecutar `exec()` ve el estado real y lo
 * muta; el segundo ve la mutación ya aplicada. Eso es exactamente la
 * atomicidad a nivel fila que da un UPDATE condicionado real en Postgres.
 */
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
    { id: PAYMENT_ID, match_id: MATCH_ID, status: "approved", mp_payment_id: MP_PAYMENT_ID, payment_method: "mercadopago" },
  ]);
  return admin;
}

describe("Idempotencia CROSS-REQUEST — carrera concurrente", () => {
  it("dos requests CONCURRENTES (Promise.all) sobre el mismo payment 'approved' => MP se llama exactamente 1 vez", async (t) => {
    let refundCallCount = 0;

    t.mock.module("../mercadopago", {
      namedExports: {
        refundMercadoPagoPayment: async (mpPaymentId: string) => {
          refundCallCount += 1;
          assert.equal(mpPaymentId, MP_PAYMENT_ID);
          return { ok: true };
        },
        // El perdedor de la carrera consulta esto y, en el instante en que
        // pierde, MP todavía no terminó de procesar al ganador — el caso más
        // hostil: el perdedor NO puede asumir "ya está refunded" solo porque
        // perdió el claim.
        getMercadoPagoPaymentStatus: async () => "approved",
      },
    });

    const { refundApprovedPayment } = await import("../payment-refund");

    // UNA sola instancia de admin compartida por ambas llamadas: así el
    // claim atómico (`.eq("status","approved")`) realmente compite sobre la
    // MISMA fila, como pasaría en la DB real con dos requests HTTP distintos.
    const admin = seededAdmin();

    const [r1, r2] = await Promise.all([
      refundApprovedPayment(admin.asClient(), PAYMENT_ID),
      refundApprovedPayment(admin.asClient(), PAYMENT_ID),
    ]);

    assert.equal(refundCallCount, 1, "el POST /refunds real solo debe dispararse una vez entre los dos requests");

    const outcomes = [r1, r2];
    const refundedCount = outcomes.filter((o) => o.kind === "refunded").length;
    const failedCount = outcomes.filter((o) => o.kind === "failed").length;
    assert.equal(refundedCount, 1, "exactamente un request gana y reporta 'refunded'");
    assert.equal(failedCount, 1, "el perdedor de la carrera falla de forma segura, sin llamar a MP");
    assert.equal(admin.tables.payments[0].status, "refunded");
  });
});
