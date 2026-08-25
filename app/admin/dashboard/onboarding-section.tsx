import type { SupabaseClient } from "@supabase/supabase-js";
import OnboardingChecklist from "@/components/admin/onboarding-checklist";
import { checkAdminOnboardingStatus } from "@/lib/admin/onboarding-status";

export default async function OnboardingSection({
  supabase,
  clubId,
}: {
  supabase: SupabaseClient;
  clubId: string;
}) {
  const status = await checkAdminOnboardingStatus(supabase, clubId);
  if (status.allComplete) return null;
  return <OnboardingChecklist status={status} />;
}
