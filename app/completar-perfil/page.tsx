import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import CompletarPerfilClient from "./completar-perfil-client";

export const dynamic = "force-dynamic";

export default async function CompletarPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from(DB_TABLES.profiles)
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();
  const onboardingCompleted = Boolean(
    (profile as { onboarding_completed?: boolean | null } | null)?.onboarding_completed
  );
  if (onboardingCompleted) redirect("/home");

  return <CompletarPerfilClient />;
}
