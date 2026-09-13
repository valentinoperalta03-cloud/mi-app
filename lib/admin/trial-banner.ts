import { getClubSubscriptionSnapshot } from "@/lib/admin/club-subscription-snapshot";

export type TrialBannerInfo = { variant: "warning" | "critical"; daysLeft: number } | null;

/**
 * subscription_status/trial_end_date estan revocadas para authenticated: se leen
 * del snapshot compartido (service client) para no repetir la query con PastDueBanner.
 */
export async function getTrialBannerInfo(clubId: string): Promise<TrialBannerInfo> {
  const row = await getClubSubscriptionSnapshot(clubId);

  if (!row || row.subscription_status !== "trial" || !row.trial_end_date) return null;

  const daysLeftRaw = Math.ceil((new Date(row.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeftRaw > 7) return null;

  const daysLeft = Math.max(daysLeftRaw, 0);
  return { variant: daysLeft < 3 ? "critical" : "warning", daysLeft };
}
