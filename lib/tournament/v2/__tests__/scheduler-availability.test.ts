import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDay } from "date-fns";
import { buildSlotsForDay, isSlotWithinCourtHours, type CourtTimeRangeInput } from "../../../court-slots";

/**
 * Fase D hardening: getCourtAvailabilityForDate (lib/tournament-availability.ts)
 * ahora arma la grilla de torneos con buildSlotsForDay, cancha por cancha —
 * el mismo helper que ya usa getClubAvailability para la reserva de
 * jugador. Estos tests fijan ese comportamiento a nivel de la función pura
 * (sin depender de Supabase), que es lo que realmente decide qué slots
 * ofrece la UI.
 */
describe("disponibilidad de torneos por cancha (Fase D hardening)", () => {
  const DAY = new Date("2099-03-02T12:00:00");
  const DOW = getDay(DAY);

  it("dos canchas con distintos court_time_ranges muestran distintos slots", () => {
    const ranges: CourtTimeRangeInput[] = [
      { court_id: "A", day_of_week: DOW, open_time: "08:00", close_time: "12:00" },
      { court_id: "B", day_of_week: DOW, open_time: "18:00", close_time: "22:00" },
    ];
    const slotsA = buildSlotsForDay(["A"], DAY, ranges).map((s) => s.time);
    const slotsB = buildSlotsForDay(["B"], DAY, ranges).map((s) => s.time);
    // Grilla en pasos de 90 min desde la apertura de CADA cancha: 08:00-12:00 -> 08:00, 09:30.
    assert.ok(slotsA.includes("08:00") && slotsA.includes("09:30"));
    assert.ok(!slotsA.includes("18:00"), "Cancha A no abre a la hora de Cancha B");
    // 18:00-22:00 -> 18:00, 19:30.
    assert.ok(slotsB.includes("18:00") && slotsB.includes("19:30"));
    assert.ok(!slotsB.includes("08:00"), "Cancha B no abre a la hora de Cancha A");
  });

  it("un slot fuera del horario configurado no aparece en la grilla de esa cancha", () => {
    const ranges: CourtTimeRangeInput[] = [{ court_id: "A", day_of_week: DOW, open_time: "09:00", close_time: "13:00" }];
    const slots = buildSlotsForDay(["A"], DAY, ranges).map((s) => s.time);
    assert.ok(!slots.includes("13:30"), "13:30 empezaría un turno de 90min que termina después del cierre (13:00)");
    assert.ok(!slots.includes("22:00"), "22:00 está fuera de la franja propia de la cancha");
    assert.ok(slots.includes("10:30"), "10:30 + 90min = 12:00, todavía entra en la franja 09:00-13:00");
  });

  it("cancha sin court_time_ranges cae al horario del club, no queda sin límite", () => {
    const noRanges: CourtTimeRangeInput[] = [];
    const withClubHours = buildSlotsForDay(["A"], DAY, noRanges, { open_time: "07:00", close_time: "10:00" }).map((s) => s.time);
    assert.ok(withClubHours.includes("07:00") && withClubHours.includes("08:30"));
    assert.ok(!withClubHours.includes("10:00"), "10:00 + 90min pasaría el cierre de 10:00");
    assert.ok(!withClubHours.includes("20:00"), "fuera del horario de club configurado");
  });

  it("cancha sin court_time_ranges y sin horario de club cae al fallback duro 09:00-22:30", () => {
    const slots = buildSlotsForDay(["A"], DAY, [], null).map((s) => s.time);
    assert.ok(slots.includes("09:00"));
    assert.ok(!slots.includes("22:30"), "22:30 + 90min pasaría el cierre duro de 22:30");
    assert.ok(!slots.includes("23:00"));
  });

  it("isSlotWithinCourtHours (usado por la RPC del lado TS equivalente) sigue la misma cadena de fallback", () => {
    const ranges: CourtTimeRangeInput[] = [{ court_id: "A", day_of_week: 1, open_time: "09:00", close_time: "13:00" }];
    assert.equal(isSlotWithinCourtHours("A", 1, 9 * 60, 90, ranges), true);
    assert.equal(isSlotWithinCourtHours("A", 1, 12 * 60, 90, ranges), false);
    assert.equal(isSlotWithinCourtHours("B", 1, 22 * 60, 60, []), false, "sin franjas ni horario de club: fallback duro 09:00-22:30");
    assert.equal(isSlotWithinCourtHours("B", 1, 10 * 60, 60, [], { open_time: "08:00", close_time: "23:00" }), true);
  });
});
