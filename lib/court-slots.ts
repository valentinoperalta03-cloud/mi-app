import { getDay } from "date-fns";

export type ScheduleInput = {
  court_id: string;
  /** null en filas solo de precio por franja; se ignoran al armar la grilla. */
  day_of_week: number | null;
  open_time: string | null;
  close_time: string | null;
};

export type GeneratedSlot = { time: string; duration: number };

export type CourtBlockModernRow = { blocked_time: string | null };
export type CourtBlockLegacyRow = { start_time: string | null };

/** Horario base del club (`clubs.open_time` / `clubs.close_time`), opcional. */
export type ClubHoursBounds = { open_time: string | null; close_time: string | null };

/**
 * Genera una grilla de slots desde openMin hasta que el inicio del turno
 * alcanza closeMin. El último slot puede terminar después de closeMin
 * (ej. 23:00→00:30 cuando closeMin=1440), lo que es correcto: el club
 * indicó que abre a X y los turnos van hasta cruzar medianoche.
 */
function buildGrid(openMin: number, closeMin: number, durationMinutes: number): GeneratedSlot[] {
  const slots: GeneratedSlot[] = [];
  for (let t = openMin; t < closeMin; t += durationMinutes) {
    slots.push({ time: minutesToClock(t), duration: durationMinutes });
  }
  return slots;
}

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

export function parseClockToMinutes(clock: string): number {
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

/**
 * Parsea un horario de cierre.
 * "00:00" y "23:59" se tratan como medianoche (1440 min), porque un club
 * que cierra "a las 23:59" quiere que el turno 22:30→00:00 aparezca.
 */
function parseCloseTimeToMinutes(clock: string): number {
  const m = parseClockToMinutes(clock);
  if (m === 0 || m >= 23 * 60 + 59) return 1440;
  return m;
}

function scheduleMatchesDay(dayOfWeekRaw: number | null | undefined, dow: number): boolean {
  if (dayOfWeekRaw == null) return false;
  return Number(dayOfWeekRaw) === dow;
}

export function minutesToClock(total: number): string {
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
 * Genera los slots disponibles para el día según apertura/cierre de la cancha o del club.
 *
 * Para 90 min usa la grilla fija histórica (backward compat con reservas existentes).
 * Para otros valores genera la grilla dinámicamente desde la apertura.
 *
 * Si no hay ningún horario configurado, devuelve una grilla de fallback 09:00–22:30.
 */
export function buildSlotsForDay(
  courtIds: string[],
  dayDate: Date,
  schedules: ScheduleInput[],
  clubBounds?: ClubHoursBounds | null,
  slotDurationMinutes = 90
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

  const fallbackOpen = cb?.lo ?? 9 * 60;
  const fallbackClose = cb?.hi ?? 22 * 60 + 30;

  if (maxM <= minM) {
    return buildGrid(fallbackOpen, fallbackClose, slotDurationMinutes);
  }

  const slots = buildGrid(minM, maxM, slotDurationMinutes);
  return slots.length ? slots : buildGrid(fallbackOpen, fallbackClose, slotDurationMinutes);
}
