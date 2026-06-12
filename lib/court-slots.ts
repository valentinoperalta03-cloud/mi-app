import { getDay } from "date-fns";

export type ScheduleInput = {
  court_id: string;
  /** null en filas solo de precio por franja; se ignoran al armar la grilla. */
  day_of_week: number | null;
  open_time: string | null;
  close_time: string | null;
};

export type GeneratedSlot = { time: string; duration: 90 };

export type CourtBlockModernRow = { blocked_time: string | null };
export type CourtBlockLegacyRow = { start_time: string | null };

/** Horario base del club (`clubs.open_time` / `clubs.close_time`), opcional. */
export type ClubHoursBounds = { open_time: string | null; close_time: string | null };

/**
 * Grilla fija de turnos de 90 min alineada al cierre de las 22:30.
 * Todos los horarios del sistema usan esta grilla.
 */
const FIXED_GRID_MINUTES = [
  9 * 60,       // 09:00
  10 * 60 + 30, // 10:30
  12 * 60,      // 12:00
  13 * 60 + 30, // 13:30
  15 * 60,      // 15:00
  16 * 60 + 30, // 16:30
  18 * 60,      // 18:00
  19 * 60 + 30, // 19:30
  21 * 60,      // 21:00
  22 * 60 + 30, // 22:30 — último turno siempre
] as const;

/** Fallback cuando no hay horarios configurados: grilla completa 09:00–22:30. */
const FALLBACK_SLOTS: GeneratedSlot[] = FIXED_GRID_MINUTES.map((m) => ({
  time: minutesToClock(m),
  duration: 90,
}));

/** Normaliza HH:MM desde columnas `blocked_time` o `start_time`. */
export function normalizeSlotTime(t: string | null | undefined): string {
  if (!t) return "";
  return String(t).trim().slice(0, 5);
}

/** Une bloqueos modernos (`blocked_time`) y legacy (`start_time`) en un Set de inicios de turno. */
export function courtBlockStartsFromRows(
  modern: CourtBlockModernRow[] | null | undefined,
  legacy: CourtBlockLegacyRow[] | null | undefined
): Set<string> {
  return new Set([
    ...(modern ?? [])
      .map((b) => normalizeSlotTime(b.blocked_time))
      .filter(Boolean),
    ...(legacy ?? [])
      .map((b) => normalizeSlotTime(b.start_time))
      .filter(Boolean),
  ]);
}

function parseClockToMinutes(clock: string): number {
  let s = clock.trim();
  const tIdx = s.indexOf("T");
  if (tIdx >= 0) s = s.slice(tIdx + 1);
  s = s.replace(/[zZ].*$/, "").trim();
  const parts = s.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** Parsea un horario de cierre: "00:00" se trata como medianoche (1440 min). */
function parseCloseTimeToMinutes(clock: string): number {
  const m = parseClockToMinutes(clock);
  return m === 0 ? 1440 : m;
}

function scheduleMatchesDay(dayOfWeekRaw: number | null | undefined, dow: number): boolean {
  if (dayOfWeekRaw == null) return false;
  return Number(dayOfWeekRaw) === dow;
}

function minutesToClock(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function clubBoundsMinutes(bounds: ClubHoursBounds | null | undefined): { lo: number; hi: number } | null {
  if (!bounds) return null;
  const o = String(bounds.open_time ?? "").trim();
  const c = String(bounds.close_time ?? "").trim();
  if (!o || !c) return null;
  const lo = parseClockToMinutes(o);
  const hi = parseCloseTimeToMinutes(c);
  if (!(hi > lo)) return null;
  return { lo, hi };
}

/**
 * Genera los slots disponibles para el día filtrando la grilla fija (09:00–22:30)
 * por el horario de apertura/cierre de la cancha o del club.
 *
 * Regla: un slot se muestra si su hora de inicio >= apertura Y < cierre.
 * Esto garantiza que el turno 22:30 aparece siempre que el cierre sea > 22:30
 * (p. ej. "23:59" o "00:00" que se interpreta como medianoche).
 *
 * Si `clubBounds` se pasa null/undefined, se usan solo los horarios por cancha.
 * Si no hay ningún horario configurado, devuelve la grilla completa como fallback.
 */
export function buildSlotsForDay(
  courtIds: string[],
  dayDate: Date,
  schedules: ScheduleInput[],
  clubBounds?: ClubHoursBounds | null
): GeneratedSlot[] {
  const dow = getDay(dayDate);
  const cb = clubBoundsMinutes(clubBounds ?? null);

  let minM = 24 * 60;
  let maxM = 0;

  for (const cid of courtIds) {
    const daySchedules = schedules.filter(
      (x) => String(x.court_id) === String(cid) && scheduleMatchesDay(x.day_of_week, dow)
    );

    if (!daySchedules.length) {
      // Sin horario propio → usar horario del club como fallback
      if (cb) {
        minM = Math.min(minM, cb.lo);
        maxM = Math.max(maxM, cb.hi);
      }
      continue;
    }

    for (const s of daySchedules) {
      if (!s.open_time || !s.close_time) continue;
      const o = parseClockToMinutes(String(s.open_time));
      const c = parseCloseTimeToMinutes(String(s.close_time));
      if (!(c > o)) continue;
      minM = Math.min(minM, o);
      maxM = Math.max(maxM, c);
    }
  }

  if (maxM <= minM) {
    return FALLBACK_SLOTS;
  }

  // Filtrar la grilla fija: slots que empiezan dentro del rango [minM, maxM)
  const slots = FIXED_GRID_MINUTES
    .filter((t) => t >= minM && t < maxM)
    .map((t) => ({ time: minutesToClock(t), duration: 90 as const }));

  return slots.length ? slots : FALLBACK_SLOTS;
}
