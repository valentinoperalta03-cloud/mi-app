import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOLD_MINUTES,
  computeHoldExpiresAt,
  isHoldExpired,
  isPendingHoldConflictError,
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

  it("hold con hold_expires_at futuro no está vencido", () => {
    const holdExpiresAt = new Date(now + 5 * 60_000).toISOString();
    assert.equal(isHoldExpired({ hold_expires_at: holdExpiresAt }, now), false);
  });

  it("hold con hold_expires_at pasado está vencido", () => {
    const holdExpiresAt = new Date(now - 1_000).toISOString();
    assert.equal(isHoldExpired({ hold_expires_at: holdExpiresAt }, now), true);
  });

  it("hold justo en el límite (hold_expires_at === now) está vencido", () => {
    assert.equal(isHoldExpired({ hold_expires_at: new Date(now).toISOString() }, now), true);
  });

  it("fila legacy sin hold_expires_at usa HOLD_MINUTES desde created_at", () => {
    const justUnder = new Date(now - (HOLD_MINUTES * 60_000 - 1_000)).toISOString();
    const justOver = new Date(now - (HOLD_MINUTES * 60_000 + 1_000)).toISOString();
    assert.equal(isHoldExpired({ created_at: justUnder }, now), false);
    assert.equal(isHoldExpired({ created_at: justOver }, now), true);
  });

  it("sin hold_expires_at ni created_at no se considera vencido", () => {
    assert.equal(isHoldExpired({}, now), false);
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
      message:
        'duplicate key value violates unique constraint "one_pending_reservation_hold_per_owner"',
    };
    assert.equal(isPendingHoldConflictError(err), true);
  });

  it("no confunde otra violación de unicidad (ej. slot de cancha)", () => {
    const err = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "unique_court_slot"',
    };
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
