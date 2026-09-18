import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canTransitionPaymentRow, assertPaymentRowTransition, assertMatchPaymentStatusTransition } from "../state-machines/payment-states";
import { canTransitionMatch, assertMatchTransition } from "../state-machines/match-states";
import { IllegalTransitionError } from "../state-machines/errors";
import { refundApprovedPayment, refundReservationPayment, type PaymentRefundOutcome } from "../payment-refund";

/**
 * Cubre el bug real de producción: un webhook de MP "approved" atrasado o
 * reintentado para el MISMO mp_payment_id resucitaba un pago ya reembolsado
 * (payments.status: refunded -> approved, matches.payment_status: refunded ->
 * paid) porque el idempotent-skip solo comparaba contra "approved" y el
 * try/catch alrededor de los asserts de state-machine logueaba la transición
 * ilegal pero NO frenaba el UPDATE. Caso real: match
 * 5dbff2fd-74b1-4580-bd09-2bacb274fdad, mp_payment_id 178397809431.
 *
 * A/B/C/D usan las funciones puras de state-machine directamente (sin DB).
 * E/F/G ejercitan lib/payment-refund.ts contra un fake de Supabase en
 * memoria + refundMercadoPagoPayment real con mp_payment_id="dev_simulated"
 * (atajo ya existente en lib/mercadopago.ts que evita la llamada de red real,
 * pensado justo para este tipo de test).
 */

// ---------------------------------------------------------------------------
// Fake mínimo de Supabase: solo los métodos que payment-refund.ts usa
// (select/eq/in/maybeSingle, update/eq -> {error}). No es un mock genérico:
// alcanza para lo que este archivo ejercita.
// ---------------------------------------------------------------------------

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
  failUpdateFor = new Set<string>();
  /** Falla más selectiva que failUpdateFor: solo el UPDATE cuyo patch matchea el predicado. */
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
        const shouldFail = this.failUpdateFor.has(table) || Boolean(this.failUpdateWhen?.(table, patch));
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

function seededAdmin(overrides?: { paymentStatus?: string; matchPaymentStatus?: string }): FakeAdmin {
  const admin = new FakeAdmin();
  admin.seed("clubs", [{ id: CLUB_ID, mp_access_token: "club-token" }]);
  admin.seed("courts", [{ id: COURT_ID, club_id: CLUB_ID }]);
  admin.seed("matches", [
    {
      id: MATCH_ID,
      court_id: COURT_ID,
      payment_status: overrides?.matchPaymentStatus ?? "paid",
      financial_status: "partially_paid",
      total_price: 50000,
    },
  ]);
  admin.seed("payments", [
    {
      id: PAYMENT_ID,
      match_id: MATCH_ID,
      status: overrides?.paymentStatus ?? "approved",
      mp_payment_id: "dev_simulated",
      payment_method: "mercadopago",
    },
  ]);
  return admin;
}

describe("A. payment refunded + webhook approved mismo mp_payment_id => sigue refunded", () => {
  it("canTransitionPaymentRow(refunded, approved) es falso", () => {
    assert.equal(canTransitionPaymentRow("refunded", "approved"), false);
  });

  it("assertPaymentRowTransition(refunded, approved) lanza IllegalTransitionError", () => {
    assert.throws(
      () => assertPaymentRowTransition("refunded", "approved", { trigger: "test" }),
      IllegalTransitionError
    );
  });
});

describe("B. match payment_status refunded + webhook approved => sigue refunded/unpaid", () => {
  it("assertMatchPaymentStatusTransition(refunded, paid) lanza IllegalTransitionError", () => {
    assert.throws(
      () => assertMatchPaymentStatusTransition("refunded", "paid", { trigger: "test" }),
      IllegalTransitionError
    );
  });
});

describe("C. refund_requested + webhook approved atrasado => no resucita", () => {
  it("canTransitionPaymentRow(refund_requested, approved) es falso", () => {
    assert.equal(canTransitionPaymentRow("refund_requested", "approved"), false);
  });

  it("assertPaymentRowTransition(refund_requested, approved) lanza IllegalTransitionError", () => {
    assert.throws(
      () => assertPaymentRowTransition("refund_requested", "approved", { trigger: "test" }),
      IllegalTransitionError
    );
  });
});

describe("D. approved normal sin refund => el flujo legacy sigue funcionando", () => {
  it("pending -> approved (payments.status) sigue permitido", () => {
    assert.equal(canTransitionPaymentRow("pending", "approved"), true);
    assert.doesNotThrow(() => assertPaymentRowTransition("pending", "approved", { trigger: "test" }));
  });

  it("pending -> paid (matches.payment_status) sigue permitido", () => {
    assert.doesNotThrow(() => assertMatchPaymentStatusTransition("pending", "paid", { trigger: "test" }));
  });

  it("scheduled -> reserved (matches.match_status) sigue permitido", () => {
    assert.equal(canTransitionMatch("scheduled", "reserved"), true);
    assert.doesNotThrow(() => assertMatchTransition("scheduled", "reserved", { trigger: "test" }));
  });
});

describe("E. MP refund success + actualización local correcta", () => {
  it("refundApprovedPayment: payment queda refunded", async () => {
    const admin = seededAdmin();
    const outcome = await refundApprovedPayment(admin.asClient(), PAYMENT_ID);
    assert.deepEqual(outcome, { kind: "refunded" });
    assert.equal(admin.tables.payments[0].status, "refunded");
  });

  it("refundReservationPayment: payment y match quedan refunded/unpaid", async () => {
    const admin = seededAdmin();
    const outcome = await refundReservationPayment(admin.asClient(), MATCH_ID);
    assert.deepEqual(outcome, { kind: "refunded" });
    assert.equal(admin.tables.payments[0].status, "refunded");
    const match = admin.tables.matches[0];
    assert.equal(match.payment_status, "refunded");
    assert.equal(match.financial_status, "unpaid");
    assert.equal(match.amount_paid, 0);
    assert.equal(match.amount_pending, 50000);
  });
});

describe("F. DB update falla después de MP success => detectable, nunca éxito silencioso", () => {
  it("refundApprovedPayment: UPDATE final de payments (approved->refunded) falla -> refunded_unsynced, no 'refunded'", async () => {
    const admin = seededAdmin();
    // El claim atómico (approved -> refund_requested) debe poder ejecutarse
    // igual (si no, nunca se llegaría a llamar a MP) — solo falla el UPDATE
    // final que marca "refunded" después del éxito en MP.
    admin.failUpdateWhen = (table, patch) => table === "payments" && patch.status === "refunded";
    const outcome: PaymentRefundOutcome = await refundApprovedPayment(admin.asClient(), PAYMENT_ID);
    assert.equal(outcome.kind, "refunded_unsynced");
    assert.notEqual(outcome.kind, "refunded");
    // La fila local NO quedó marcada refunded pese a que MP sí reembolsó
    // (mp_payment_id "dev_simulated" = éxito simulado) — pero el claim SÍ se
    // persistió, así que queda en "refund_requested" (visible para
    // reconciliación), no silenciosamente en "approved" como si nada hubiera
    // pasado.
    assert.equal(admin.tables.payments[0].status, "refund_requested");
  });

  it("refundReservationPayment: UPDATE de matches falla tras refund exitoso -> refunded_unsynced, no 'refunded'", async () => {
    const admin = seededAdmin();
    admin.failUpdateFor.add("matches");
    const outcome = await refundReservationPayment(admin.asClient(), MATCH_ID);
    assert.equal(outcome.kind, "refunded_unsynced");
    assert.notEqual(outcome.kind, "refunded");
    // El payment SÍ se marcó refunded (esa tabla no falla en este caso) — es
    // justamente el escenario peligroso: MP + payments dicen "refunded", pero
    // matches quedó desincronizado. El caller nunca debe reportarlo como éxito.
    assert.equal(admin.tables.payments[0].status, "refunded");
  });
});

describe("G. carrera simulada refund/webhook => el estado terminal 'refunded' gana", () => {
  it("un refund real corre primero (payments queda refunded); un 'approved' tardío para el mismo pago es rechazado por la state machine", async () => {
    const admin = seededAdmin();

    // 1) El admin pide el reembolso — corre primero y gana la carrera.
    const refundOutcome = await refundReservationPayment(admin.asClient(), MATCH_ID);
    assert.deepEqual(refundOutcome, { kind: "refunded" });
    assert.equal(admin.tables.payments[0].status, "refunded");
    assert.equal(admin.tables.matches[0].payment_status, "refunded");

    // 2) Un webhook "approved" atrasado del mismo mp_payment_id llega después
    // (mismo chequeo que hace lib/mp-handlers/payment-webhook-handler.ts
    // antes de escribir: assertPaymentRowTransition sobre el estado YA
    // persistido). Debe ser rechazado, no debe poder revertir el estado.
    const paymentRowNow = admin.tables.payments[0];
    assert.throws(
      () => assertPaymentRowTransition(paymentRowNow.status as string, "approved", { trigger: "test" }),
      IllegalTransitionError
    );
    const matchNow = admin.tables.matches[0];
    assert.throws(
      () => assertMatchPaymentStatusTransition(matchNow.payment_status as string, "paid", { trigger: "test" }),
      IllegalTransitionError
    );

    // 3) Estado final: sigue refunded/unpaid, nunca resucitó a approved/paid.
    assert.equal(admin.tables.payments[0].status, "refunded");
    assert.equal(admin.tables.matches[0].payment_status, "refunded");
    assert.equal(admin.tables.matches[0].financial_status, "unpaid");
  });

  it("idempotencia: pedir refund otra vez después de un refund real no vuelve a llamar a MP (ya_refunded, no re-intento)", async () => {
    const admin = seededAdmin();
    await refundReservationPayment(admin.asClient(), MATCH_ID);
    assert.equal(admin.tables.matches[0].payment_status, "refunded");

    // Segundo pedido de refund sobre el mismo match: refundReservationPayment
    // chequea matches.payment_status === "refunded" ANTES de tocar payments,
    // así que ni siquiera llega a mirar la fila de payments (que ya no
    // calificaría igual: status "refunded" queda afuera del filtro
    // .in("status", ["approved","refund_requested"])).
    const secondOutcome = await refundReservationPayment(admin.asClient(), MATCH_ID);
    assert.deepEqual(secondOutcome, { kind: "already_refunded" });
  });
});
