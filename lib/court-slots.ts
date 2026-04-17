import { getDay } from "date-fns";

export type ScheduleInput = {
  court_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
};

export type GeneratedSlot = { time: string; duration: 90 };

const FALLBACK_SLOTS: GeneratedSlot[] = [
  { time: "08:00", duration: 90 },
  { time: "09:30", duration: 90 },
  { time: "11:00", duration: 90 },
  { time: "12:30", duration: 90 },
  { time: "14:00", duration: 90 },
  { time: "15:30", duration: 90 },
  { time: "17:00", duration: 90 },
  { time: "18:30", duration: 90 },
];

function parseClockToMinutes(clock: string): number {
  const parts = clock.trim().split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function minutesToClock(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Une horarios de todas las canchas del club para el día y genera slots de 90 min.
 */
export function buildSlotsForDay(
  courtIds: string[],
  dayDate: Date,
  schedules: ScheduleInput[]
): GeneratedSlot[] {
  const dow = getDay(dayDate);
  let minM = 24 * 60;
  let maxM = 0;

  for (const cid of courtIds) {
    const s = schedules.find(
      (x) => x.court_id === cid && x.day_of_week === dow
    );
    if (s?.open_time && s?.close_time) {
      const o = parseClockToMinutes(s.open_time);
      const c = parseClockToMinutes(s.close_time);
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
