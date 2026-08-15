"use server";

import { DB_TABLES } from "@/lib/db-tables";
import {
  buildSlotsForDay,
  normalizeSlotTime,
  type ClubHoursBounds,
  type CourtTimeRangeInput,
} from "@/lib/court-slots";
import { getCurrentClockInArgentina, getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { createClient } from "@/utils/supabase/server";

export type AvailabilitySlot = { time: string; courtIds: string[] };

export type ClubAvailabilityResult = {
  slots: AvailabilitySlot[];
  prices: Record<string, number>;
};

function clockToMinutes(clock: string): number {
  const [h, m] = clock.trim().slice(0, 5).split(":").map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export async function getClubAvailability(
  clubId: string,
  dateStr: string
): Promise<ClubAvailabilityResult> {
  if (!clubId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { slots: [], prices: {} };

  const supabase = await createClient();

  const { data: courtRows } = await supabase.from(DB_TABLES.courts).select("id").eq("club_id", clubId);
  const courtIds = ((courtRows ?? []) as { id: string }[]).map((c) => c.id);
  if (courtIds.length === 0) return { slots: [], prices: {} };

  const { data: clubRow } = await supabase
    .from(DB_TABLES.clubs)
    .select("open_time,close_time")
    .eq("id", clubId)
    .maybeSingle();
  const clubBounds = (clubRow ?? null) as ClubHoursBounds | null;

  const { data: rangeRows } = await supabase
    .from(DB_TABLES.courtTimeRanges)
    .select("court_id,day_of_week,open_time,close_time")
    .in("court_id", courtIds);
  const timeRanges = (rangeRows ?? []) as CourtTimeRangeInput[];

  const dayDate = new Date(`${dateStr}T12:00:00`);

  // buildSlotsForDay ignora en qué franja propia cae cada cancha cuando se le
  // pasan varios courtIds a la vez (devuelve la unión de horarios) — hay que
  // pedirle los slots cancha por cancha para saber si ESA cancha realmente
  // abre en ese horario, no solo alguna del club.
  const perCourtSlots = new Map<string, Set<string>>();
  for (const cid of courtIds) {
    const slotsForCourt = buildSlotsForDay([cid], dayDate, timeRanges, clubBounds);
    perCourtSlots.set(cid, new Set(slotsForCourt.map((s) => s.time)));
  }
  const orderedTimes = Array.from(
    new Set(Array.from(perCourtSlots.values()).flatMap((s) => Array.from(s)))
  ).sort((a, b) => clockToMinutes(a) - clockToMinutes(b));

  const [{ data: matchRows }, { data: blockRowsModern }, { data: blockRowsLegacy }, { data: schedRows }] =
    await Promise.all([
      supabase
        .from(DB_TABLES.matches)
        .select("court_id,scheduled_time")
        .in("court_id", courtIds)
        .eq("scheduled_date", dateStr)
        .neq("match_status", "cancelled"),
      supabase
        .from(DB_TABLES.courtBlocks)
        .select("court_id,blocked_time")
        .in("court_id", courtIds)
        .eq("blocked_date", dateStr),
      supabase
        .from(DB_TABLES.courtBlocks)
        .select("court_id,start_time")
        .in("court_id", courtIds)
        .eq("date", dateStr),
      supabase
        .from(DB_TABLES.courtSchedules)
        .select("court_id,start_time,price_override")
        .in("court_id", courtIds)
        .is("day_of_week", null)
        .not("start_time", "is", null)
        .not("price_override", "is", null),
    ]);

  const occupied = new Set<string>();
  for (const m of (matchRows ?? []) as { court_id: string | null; scheduled_time: string | null }[]) {
    if (m.court_id) occupied.add(`${m.court_id}__${normalizeSlotTime(m.scheduled_time)}`);
  }
  for (const b of (blockRowsModern ?? []) as { court_id: string | null; blocked_time: string | null }[]) {
    if (b.court_id) occupied.add(`${b.court_id}__${normalizeSlotTime(b.blocked_time)}`);
  }
  for (const b of (blockRowsLegacy ?? []) as { court_id: string | null; start_time: string | null }[]) {
    if (b.court_id) occupied.add(`${b.court_id}__${normalizeSlotTime(b.start_time)}`);
  }

  const prices: Record<string, number> = {};
  for (const r of (schedRows ?? []) as {
    court_id: string | null;
    start_time: string | null;
    price_override: number | null;
  }[]) {
    if (r.court_id && r.price_override != null) {
      prices[`${r.court_id}__${normalizeSlotTime(r.start_time)}`] = Number(r.price_override);
    }
  }

  const todayAr = getTodayYmdInArgentina();
  const nowMinutes = dateStr === todayAr ? clockToMinutes(getCurrentClockInArgentina()) : -1;

  const slots: AvailabilitySlot[] = [];
  for (const time of orderedTimes) {
    if (nowMinutes >= 0 && clockToMinutes(time) <= nowMinutes) continue;
    const freeCourtIds = courtIds.filter(
      (cid) => perCourtSlots.get(cid)!.has(time) && !occupied.has(`${cid}__${time}`)
    );
    if (freeCourtIds.length > 0) slots.push({ time, courtIds: freeCourtIds });
  }

  return { slots, prices };
}
