import { addDays, format, getISODay, parseISO } from "date-fns";
import { MAX_PRACTICE_WEEKS_AHEAD } from "@/lib/practice-constants";

export type PracticeSessionRow = { session_date: string; start_time: string };

function isoWeekday(date: Date): number {
  return getISODay(date);
}

/**
 * Genera fechas de sesión para publicar una práctica.
 * `weekly_days`: 1 = lunes … 7 = domingo (ISO).
 */
export function buildPracticeSessionRows(params: {
  recurrenceType: "once" | "weekly";
  startDate: string;
  endDate: string;
  startTime: string;
  weeklyDays: number[];
}): PracticeSessionRow[] {
  const start = parseISO(params.startDate);
  const end = parseISO(params.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [];
  }
  const time = params.startTime.length === 5 ? `${params.startTime}:00` : params.startTime;

  if (params.recurrenceType === "once") {
    return [{ session_date: format(start, "yyyy-MM-dd"), start_time: time }];
  }

  const days = new Set(
    params.weeklyDays.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
  );
  if (days.size === 0) return [];

  const rows: PracticeSessionRow[] = [];
  const maxEnd = addDays(start, MAX_PRACTICE_WEEKS_AHEAD * 7);
  const limit = end < maxEnd ? end : maxEnd;
  let cur = start;
  while (cur <= limit) {
    if (days.has(isoWeekday(cur))) {
      rows.push({ session_date: format(cur, "yyyy-MM-dd"), start_time: time });
    }
    cur = addDays(cur, 1);
  }
  return rows;
}
