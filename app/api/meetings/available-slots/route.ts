import { NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { minutesToClock, parseClockToMinutes } from "@/lib/court-slots";
import { createServiceClient } from "@/utils/supabase/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = (url.searchParams.get("date") ?? "").trim();
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
  }

  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  const svc = createServiceClient();

  const { data: availabilityRows } = await svc
    .from(DB_TABLES.meetingAvailability)
    .select("start_time,end_time,slot_duration_minutes")
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true);

  const { data: meetingRows } = await svc
    .from(DB_TABLES.meetings)
    .select("meeting_time")
    .eq("meeting_date", date)
    .neq("status", "cancelled");

  const occupied = new Set(
    (meetingRows ?? []).map((r) => String((r as { meeting_time: string }).meeting_time).slice(0, 5))
  );

  const times = new Set<string>();
  for (const row of (availabilityRows ?? []) as Array<{
    start_time: string;
    end_time: string;
    slot_duration_minutes: number;
  }>) {
    const start = parseClockToMinutes(row.start_time);
    const end = parseClockToMinutes(row.end_time);
    const duration = Math.max(1, Number(row.slot_duration_minutes) || 30);
    for (let t = start; t + duration <= end; t += duration) {
      times.add(minutesToClock(t));
    }
  }

  const slots = Array.from(times)
    .sort()
    .map((time) => ({ time, available: !occupied.has(time) }));

  return NextResponse.json({ slots });
}
