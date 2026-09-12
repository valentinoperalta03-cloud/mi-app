import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { getPastDueBannerInfo } from "@/lib/admin/subscription-past-due-banner";
import { createClient } from "@/utils/supabase/server";
import PastDueBannerClient from "./past-due-banner-client";

export default async function PastDueBanner() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  const clubId = ctx?.clubIds[0];
  if (!clubId) return null;

  const info = await getPastDueBannerInfo(clubId);
  if (!info) return null;

  return <PastDueBannerClient daysLeft={info.daysLeft} reasonLabel={info.reasonLabel} />;
}
