import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { getPastDueBannerInfo } from "@/lib/admin/subscription-past-due-banner";
import PastDueBannerClient from "./past-due-banner-client";

export default async function PastDueBanner() {
  const ctx = await getOwnerAdminContext();
  const clubId = ctx?.clubIds[0];
  if (!clubId) return null;

  const info = await getPastDueBannerInfo(clubId);
  if (!info) return null;

  return <PastDueBannerClient daysLeft={info.daysLeft} reasonLabel={info.reasonLabel} />;
}
