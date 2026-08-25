import type { SupabaseClient } from "@supabase/supabase-js";
import DashboardClient from "./dashboard-client";
import {
  buildDashboardTimelineData,
  type DashboardTimelineMatchRow,
} from "./dashboard-timeline-data";
import type { TimelineCourt } from "./timeline-grid";

export default async function TimelineSection({
  supabase,
  todayYmd,
  courts,
  courtIds,
  clubIds,
  clubBounds,
  todayMatches,
}: {
  supabase: SupabaseClient;
  todayYmd: string;
  courts: TimelineCourt[];
  courtIds: string[];
  clubIds: string[];
  clubBounds: { open_time: string | null; close_time: string | null } | null;
  todayMatches: DashboardTimelineMatchRow[];
}) {
  const data = await buildDashboardTimelineData(
    supabase,
    courts,
    courtIds,
    clubIds,
    clubBounds,
    todayYmd,
    todayMatches
  );

  return <DashboardClient todayYmd={todayYmd} courts={courts} initialData={data} />;
}
