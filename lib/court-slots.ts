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

const FALLBACK_SLOTS: GeneratedSlot[] = [
  { time: "08:00", duration: 90 },
  { time: "09:30", duration: 90 },
  { time: "11:00", duration: 90 },
  { time: "12:30", duration: 90 },
  { time: "14:00", duration: 90 },
  { time: "15:30", duration: 90 },
  { time: "17:00", duration: 90 },
  { time: "18:30", duration: 90 },
  { time: "20:00", duration: 90 },
  { time: "21:30", duration: 90 },
];

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
  const hi = parseClockToMinutes(c);
  if (!(hi > lo)) return null;
  return { lo, hi };
}

/**
 * Une horarios de canchas para el día y genera slots de 90 min.
 * Si `clubBounds` trae apertura/cierre del club, actúa como marco global;
 * una cancha puede extender el cierre más allá del cierre general (ej. techada).
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
      if (cb) {
        minM = Math.min(minM, cb.lo);
        maxM = Math.max(maxM, cb.hi);
      }
      continue;
    }

    for (const s of daySchedules) {
      if (!s.open_time || !s.close_time) continue;
      let o = parseClockToMinutes(String(s.open_time));
      let c = parseClockToMinutes(String(s.close_time));
      if (!(c > o)) continue;
      if (cb) {
        o = Math.max(o, cb.lo);
        c = c > cb.hi ? c : Math.min(c, cb.hi);
      }
      if (c > o) {
        minM = Math.min(minM, o);
        maxM = Math.max(maxM, c);
      }
    }
  }

  if (maxM <= minM) {
    return FALLBACK_SLOTS;
  }

  const slots: GeneratedSlot[] = [];
  let cur = minM;
  const dur = 90;
  while (cur + dur <= maxM) {
    slots.push({ time: minutesToClock(cur), duration: dur });
    cur += dur;
  }

  return slots.length ? slots : FALLBACK_SLOTS;
}
