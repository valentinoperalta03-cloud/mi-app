import { addDays, format } from "date-fns";
import { type NextRequest, NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { generateMatchForSlotOnDate } from "@/lib/fixed-slot-generator";
import { createServiceClient } from "@/utils/supabase/server";

function getArgentinaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return new Date(`${y}-${m}-${d}T12:00:00`);
}

function cronSecretFromRequest(req: NextRequest): string | null {
  const bearer = req.headers.get("authorization");
  const bearerSecret =
    bearer?.startsWith("Bearer ") ? bearer.slice("Bearer ".length).trim() : null;
  return (
    req.headers.get("x-cron-secret")?.trim() ??
    req.nextUrl.searchParams.get("secret") ??
    bearerSecret
  );
}

export async function GET(req: NextRequest) {
  const secret = cronSecretFromRequest(req);
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const targetDateObj = addDays(getArgentinaNow(), 7);
  const targetDate = format(targetDateObj, "yyyy-MM-dd");
  const dayOfWeek = targetDateObj.getDay();

  const { data: slotsRaw } = await supabase
    .from(DB_TABLES.fixedSlots)
    .select("id,club_id,court_id,day_of_week,start_time,duration_minutes,is_active")
    .eq("is_active", true)
    .eq("day_of_week", dayOfWeek);

  const slots = (slotsRaw ?? []) as Array<{
    id: string;
    club_id: string;
    court_id: string;
    day_of_week: number;
    start_time: string;
    duration_minutes: number;
    is_active: boolean;
  }>;

  let created = 0;
  for (const slot of slots) {
    const ok = await generateMatchForSlotOnDate(supabase, slot, targetDate);
    if (ok) created++;
  }

  return NextResponse.json({ ok: true, targetDate, created });
}
