import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { getTrialBannerInfo } from "@/lib/admin/trial-banner";
import { createClient } from "@/utils/supabase/server";
import TrialBannerClient from "./trial-banner-client";

export default async function TrialBanner() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  const clubId = ctx?.clubIds[0];
  if (!clubId) return null;

  const info = await getTrialBannerInfo(clubId);
  if (!info) return null;

  return <TrialBannerClient variant={info.variant} daysLeft={info.daysLeft} />;
}
