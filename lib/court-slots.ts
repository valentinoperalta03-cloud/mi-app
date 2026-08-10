import { getDay } from "date-fns";

/** Fila de court_time_ranges: franja horaria propia de una cancha para un día de semana. */
export interface CourtTimeRangeInput {
  court_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
}

/**
 * Alias legacy: mismo shape que CourtTimeRangeInput. Lo mantenemos porque
 * edit-match-form.tsx todavía arma sus filas desde court_schedules (rama
 * día-de-semana) y las castea `as ScheduleInput[]` — no se toca ese archivo
 * en este cambio, así que el tipo tiene que seguir existiendo con este nombre.
 */
export type ScheduleInput = CourtTimeRangeInput;

export type GeneratedSlot = { time: string; duration: number };

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
export function parseCloseTimeToMinutes(clock: string): number {
  const m = parseClockToMinutes(clock);
  if (m === 0 || m >= 23 * 60 + 59) return 1440;
  return m;
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
 * Genera los slots disponibles para el día a partir de las franjas propias de
 * cada cancha (`court_time_ranges`). Una cancha puede tener varias franjas no
 * contiguas el mismo día (ej. 08:00–12:30 y 16:00–22:00) — se generan slots
 * por franja y se devuelve la unión, sin puentear el hueco entre franjas.
 *
 * Si la cancha no tiene ninguna franja propia para ese día de semana, cae al
 * horario del club (`clubBounds`) como una única franja. Si tampoco hay
 * horario de club configurado, fallback hardcodeado 09:00–22:30.
 */
export function buildSlotsForDay(
  courtIds: string[],
  dayDate: Date,
  timeRanges: CourtTimeRangeInput[],
  clubBounds?: ClubHoursBounds | null,
  slotDurationMinutes = 90
): GeneratedSlot[] {
  const dow = getDay(dayDate);
  const cb = clubBoundsMinutes(clubBounds ?? null);
  const fallbackOpen = cb?.lo ?? 9 * 60;
  const fallbackClose = cb?.hi ?? 22 * 60 + 30;

  const times = new Set<string>();

  for (const cid of courtIds) {
    const dayRanges = timeRanges.filter(
      (r) => String(r.court_id) === String(cid) && Number(r.day_of_week) === dow
    );

    const ranges = dayRanges
      .map((r) => ({
        open: parseClockToMinutes(String(r.open_time)),
        close: parseCloseTimeToMinutes(String(r.close_time)),
      }))
      .filter((r) => r.close > r.open);

    const effectiveRanges = ranges.length ? ranges : [{ open: fallbackOpen, close: fallbackClose }];

    for (const r of effectiveRanges) {
      for (let t = r.open; t + slotDurationMinutes <= r.close; t += slotDurationMinutes) {
        times.add(minutesToClock(t));
      }
    }
  }

  return Array.from(times)
    .sort((a, b) => parseClockToMinutes(a) - parseClockToMinutes(b))
    .map((time) => ({ time, duration: slotDurationMinutes }));
}
