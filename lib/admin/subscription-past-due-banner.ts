import { DB_TABLES } from "@/lib/db-tables";
import { translateMpStatusDetail } from "@/lib/mp-status-detail-labels";
import { createServiceClient } from "@/utils/supabase/server";

export type PastDueBannerInfo = { daysLeft: number; reasonLabel: string } | null;

/**
 * subscription_status/grace_period_end/last_status_detail estan revocadas
 * para authenticated, por eso esta consulta usa el service client (mismo
 * patron que lib/admin/trial-banner.ts).
 */
export async function getPastDueBannerInfo(clubId: string): Promise<PastDueBannerInfo> {
  const service = createServiceClient();
  const { data } = await service
    .from(DB_TABLES.clubs)
    .select("subscription_status, grace_period_end, last_status_detail")
    .eq("id", clubId)
    .maybeSingle();
  const row = data as {
    subscription_status?: string | null;
    grace_period_end?: string | null;
    last_status_detail?: string | null;
  } | null;

  if (!row || row.subscription_status !== "past_due") return null;

  const daysLeft = row.grace_period_end
    ? Math.max(Math.ceil((new Date(row.grace_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)), 0)
    : 0;

  return { daysLeft, reasonLabel: translateMpStatusDetail(row.last_status_detail) };
}
