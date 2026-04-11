import { parseISO } from "date-fns";

export type ScheduleRow = {
  court_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
};

export type MatchForAnalytics = { date: string; court_id: string };

function parseHm(s: string | null): number | null {
  if (!s || s.length < 4) return null;
  const hhmm = s.length >= 5 ? s.slice(0, 5) : s;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Horas semanales teóricas disponibles (suma todas las canchas, todos los días con horario). */
export function theoreticalWeeklyHours(schedules: ScheduleRow[]): number {
  if (schedules.length === 0) return 0;
  let minutesPerWeek = 0;
  const byCourtDay = new Map<string, ScheduleRow>();
  for (const s of schedules) {
    byCourtDay.set(`${s.court_id}-${s.day_of_week}`, s);
  }
  const courtIds = Array.from(new Set(schedules.map((s) => s.court_id)));
  for (const courtId of courtIds) {
    for (let d = 0; d < 7; d++) {
      const row = byCourtDay.get(`${courtId}-${d}`);
      const o = parseHm(row?.open_time ?? null);
      const c = parseHm(row?.close_time ?? null);
      if (o != null && c != null && c > o) {
        minutesPerWeek += c - o;
      }
    }
  }
  return minutesPerWeek / 60;
}

/** Horas ocupadas asumiendo 90 min por partido. */
export function matchOccupiedHours(matches: MatchForAnalytics[], slotMinutes = 90): number {
  return (matches.length * slotMinutes) / 60;
}

export function occupancyPercent(
  schedules: ScheduleRow[],
  matchesInWindow: MatchForAnalytics[]
) {
  const cap = theoreticalWeeklyHours(schedules);
  if (cap <= 0) return 0;
  const used = matchOccupiedHours(matchesInWindow);
  return Math.min(100, Math.round((used / cap) * 100));
}

/** Conteo por hora local (0-23) para heatmap. */
export function hourHistogram(matches: MatchForAnalytics[]) {
  const bins = Array.from({ length: 24 }, () => 0);
  for (const m of matches) {
    const d = parseISO(m.date);
    bins[d.getHours()] += 1;
  }
  return bins;
}

export function deadHoursSuggestion(bins: number[], thresholdQuantile = 0.33): number[] {
  const positive = bins.filter((b) => b > 0);
  const min = positive.length ? Math.min(...positive) : 0;
  const max = Math.max(...bins, 1);
  const cut = min + (max - min) * thresholdQuantile;
  const dead: number[] = [];
  for (let h = 0; h < 24; h++) {
    if (bins[h] <= cut && h >= 7 && h <= 22) dead.push(h);
  }
  return dead.slice(0, 8);
}
