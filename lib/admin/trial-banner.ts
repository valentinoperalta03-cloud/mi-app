import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

export type TrialBannerInfo = { variant: "warning" | "critical"; daysLeft: number } | null;

/**
 * subscription_status/trial_end_date estan revocadas para authenticated,
 * por eso esta consulta usa el service client.
 */
export async function getTrialBannerInfo(clubId: string): Promise<TrialBannerInfo> {
  const service = createServiceClient();
  const { data } = await service
    .from(DB_TABLES.clubs)
    .select("subscription_status, trial_end_date")
    .eq("id", clubId)
    .maybeSingle();
  const row = data as { subscription_status?: string | null; trial_end_date?: string | null } | null;

  if (!row || row.subscription_status !== "trial" || !row.trial_end_date) return null;

  const daysLeftRaw = Math.ceil((new Date(row.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeftRaw > 7) return null;

  const daysLeft = Math.max(daysLeftRaw, 0);
  return { variant: daysLeft < 3 ? "critical" : "warning", daysLeft };
}
