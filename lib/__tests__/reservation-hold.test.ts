import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOLD_MINUTES,
  computeHoldExpiresAt,
  isHoldExpired,
  isHoldSlotConflictError,
  isPendingHoldConflictError,
  shouldReleaseHoldOnPaymentNotification,
  slotsOverlap,
} from "../reservation-hold";

describe("computeHoldExpiresAt", () => {
  it("vence exactamente HOLD_MINUTES después de `now`", () => {
    const now = new Date("2026-09-17T18:00:00.000Z");
    const expires = new Date(computeHoldExpiresAt(now));
    assert.equal(expires.getTime() - now.getTime(), HOLD_MINUTES * 60_000);
  });
});

describe("isHoldExpired", () => {
  const now = new Date("2026-09-17T18:00:00.000Z").getTime();

  it("expires_at futuro no está vencido", () => {
    const expiresAt = new Date(now + 5 * 60_000).toISOString();
    assert.equal(isHoldExpired(expiresAt, now), false);
  });

  it("expires_at pasado está vencido", () => {
    const expiresAt = new Date(now - 1_000).toISOString();
    assert.equal(isHoldExpired(expiresAt, now), true);
  });

  it("justo en el límite (expires_at === now) está vencido", () => {
    assert.equal(isHoldExpired(new Date(now).toISOString(), now), true);
  });
});

describe("slotsOverlap", () => {
  it("slots idénticos se solapan", () => {
    assert.equal(slotsOverlap(600, 90, 600, 90), true);
  });

  it("slots consecutivos (fin = inicio del otro) no se solapan", () => {
    assert.equal(slotsOverlap(600, 90, 690, 90), false);
  });

  it("slots parcialmente superpuestos se solapan", () => {
    assert.equal(slotsOverlap(600, 90, 660, 90), true);
  });

  it("slots lejanos no se solapan", () => {
    assert.equal(slotsOverlap(600, 90, 900, 90), false);
  });
});

describe("isPendingHoldConflictError", () => {
  it("reconoce la violación del índice único de hold pendiente", () => {
    const err = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "one_pending_hold_per_owner"',
    };
    assert.equal(isPendingHoldConflictError(err), true);
  });

  it("no confunde otra violación de unicidad", () => {
    const err = { code: "23505", message: 'duplicate key value violates unique constraint "unique_court_slot"' };
    assert.equal(isPendingHoldConflictError(err), false);
  });

  it("no confunde un EXCLUDE constraint de solapamiento", () => {
    const err = { code: "23P01", message: "conflicting key value violates exclusion constraint" };
    assert.equal(isPendingHoldConflictError(err), false);
  });

  it("null/undefined no es un conflicto", () => {
    assert.equal(isPendingHoldConflictError(null), false);
    assert.equal(isPendingHoldConflictError(undefined), false);
  });
});

describe("shouldReleaseHoldOnPaymentNotification", () => {
  // Regresión incidente 2026-09-18: un webhook "cancelled" de un primer
  // intento de pago no puede liberar el hold — Checkout Pro permite un
  // segundo intento aprobado segundos después sobre el mismo hold/preferencia.
  it("no libera el hold por un status rechazado (un intento fallido no es terminal para la preferencia)", () => {
    assert.equal(shouldReleaseHoldOnPaymentNotification("rejected"), false);
  });

  it("no libera el hold por un status cancelado", () => {
    assert.equal(shouldReleaseHoldOnPaymentNotification("cancelled"), false);
  });

  it("no libera el hold por un status expirado", () => {
    assert.equal(shouldReleaseHoldOnPaymentNotification("expired"), false);
  });

  it("no libera el hold sea cual sea el status recibido (única salida: consumo o expires_at)", () => {
    assert.equal(shouldReleaseHoldOnPaymentNotification("approved"), false);
    assert.equal(shouldReleaseHoldOnPaymentNotification("in_process"), false);
    assert.equal(shouldReleaseHoldOnPaymentNotification(""), false);
  });
});

describe("isHoldSlotConflictError", () => {
  it("reconoce la violación del EXCLUDE de solapamiento entre holds", () => {
    const err = {
      code: "23P01",
      message: 'conflicting key value violates exclusion constraint "reservation_holds_no_overlap"',
    };
    assert.equal(isHoldSlotConflictError(err), true);
  });

  it("no confunde la violación del índice único de hold pendiente", () => {
    const err = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "one_pending_hold_per_owner"',
    };
    assert.equal(isHoldSlotConflictError(err), false);
  });
});
