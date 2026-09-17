import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Tripwire estático: hubiera detectado el bug real de producción (920
 * ocurrencias de turno fijo canceladas por la limpieza legacy de
 * 20260917110000_matches_reservation_hold.sql, que no excluía
 * es_turno_fijo/fixed_slot_id). No requiere DB — lee el código fuente.
 */

const CRON_PATH = "app/api/cron/expire-unpaid-matches/route.ts";
const HOLD_LIB_PATH = "lib/reservation-hold.ts";
const FIX_MIGRATION_PATH = "supabase/migrations/20260917130000_fix_reservation_hold_index_exclude_fixed_slots.sql";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf-8");
}

describe("expire-unpaid-matches nunca toca turnos fijos", () => {
  const source = readRepoFile(CRON_PATH);

  it("excluye por es_turno_fijo", () => {
    assert.match(source, /es_turno_fijo/);
  });

  it("excluye por fixed_slot_id (columna separada, defensa en profundidad)", () => {
    assert.match(source, /fixed_slot_id/);
  });
});

describe("lib/reservation-hold.ts nunca toca matches", () => {
  const source = readRepoFile(HOLD_LIB_PATH);

  it("no referencia DB_TABLES.matches", () => {
    assert.doesNotMatch(source, /DB_TABLES\.matches\b/);
  });

  it("no referencia es_turno_fijo (no debería necesitarlo: opera solo sobre reservation_holds)", () => {
    assert.doesNotMatch(source, /es_turno_fijo/);
  });
});

describe("migración de fix de turnos fijos", () => {
  const source = readRepoFile(FIX_MIGRATION_PATH);

  it("dropea el índice viejo antes de recrearlo", () => {
    assert.match(source, /DROP INDEX IF EXISTS one_pending_reservation_hold_per_owner/);
  });

  it("recrea el índice (transición segura: producción todavía corre el flujo legacy de MP)", () => {
    assert.match(source, /CREATE UNIQUE INDEX IF NOT EXISTS one_pending_reservation_hold_per_owner/);
  });

  it("el índice recreado excluye turnos fijos por fixed_slot_id IS NULL", () => {
    assert.match(source, /CREATE UNIQUE INDEX[\s\S]*?fixed_slot_id IS NULL/);
  });

  it("agrega el CHECK que impide hold_expires_at en turnos fijos", () => {
    assert.match(source, /CHECK \(NOT \(es_turno_fijo = true AND hold_expires_at IS NOT NULL\)\)/);
  });
});
