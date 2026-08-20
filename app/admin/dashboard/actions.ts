"use server";

import { DB_TABLES } from "@/lib/db-tables";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";
import { buildDashboardTimelineData, type DashboardTimelineData } from "./dashboard-timeline-data";

export type DashboardDayData = DashboardTimelineData;

export async function getDashboardData(dateStr: string): Promise<DashboardDayData> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { openRangesByCourtId: {}, events: [] };

  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || ctx.clubIds.length === 0) return { openRangesByCourtId: {}, events: [] };

  const { data: clubRow } = await supabase
    .from(DB_TABLES.clubs)
    .select("open_time,close_time")
    .in("id", ctx.clubIds)
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();
  const clubBounds = (clubRow ?? null) as { open_time: string | null; close_time: string | null } | null;

  return buildDashboardTimelineData(
    supabase,
    ctx.courts.map((c) => ({ id: c.id, name: c.name })),
    ctx.courtIds,
    ctx.clubIds,
    clubBounds,
    dateStr
  );
}
