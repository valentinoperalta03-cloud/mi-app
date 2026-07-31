import { NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

/** Días de la semana (0=domingo...6=sábado, igual que Date.getDay() y meeting_availability.day_of_week) con disponibilidad activa. */
export async function GET() {
  const svc = createServiceClient();
  const { data } = await svc.from(DB_TABLES.meetingAvailability).select("day_of_week").eq("is_active", true);

  const days = Array.from(new Set((data ?? []).map((r) => Number((r as { day_of_week: number }).day_of_week))));
  return NextResponse.json({ days });
}
