import { getClubSubscriptionSnapshot } from "@/lib/admin/club-subscription-snapshot";
import { translateMpStatusDetail } from "@/lib/mp-status-detail-labels";

export type PastDueBannerInfo = { daysLeft: number; reasonLabel: string } | null;

/**
 * subscription_status/grace_period_end/last_status_detail estan revocadas
 * para authenticated: se leen del snapshot compartido (service client) para
 * no repetir la query con TrialBanner.
 */
export async function getPastDueBannerInfo(clubId: string): Promise<PastDueBannerInfo> {
  const row = await getClubSubscriptionSnapshot(clubId);

  if (!row || row.subscription_status !== "past_due") return null;

  const daysLeft = row.grace_period_end
    ? Math.max(Math.ceil((new Date(row.grace_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)), 0)
    : 0;

  return { daysLeft, reasonLabel: translateMpStatusDetail(row.last_status_detail) };
}
