import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

export async function isOnboardingComplete(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from(DB_TABLES.profiles)
    .select("onboarding_completed, name, gender")
    .eq("user_id", userId)
    .maybeSingle();

  const profile = data as {
    onboarding_completed?: boolean | null;
    name?: string | null;
    gender?: string | null;
  } | null;
  return Boolean(
    profile?.onboarding_completed === true && profile?.name?.trim() && profile?.gender?.trim()
  );
}
