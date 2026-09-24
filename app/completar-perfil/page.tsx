import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { normalizeArMobile } from "@/lib/phone-ar";
import { createClient } from "@/utils/supabase/server";
import CompletarPerfilClient from "./completar-perfil-client";

export const dynamic = "force-dynamic";

export default async function CompletarPerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from(DB_TABLES.profiles)
    .select("onboarding_completed, phone")
    .eq("user_id", user.id)
    .maybeSingle();
  const onboardingCompleted = Boolean(
    (profile as { onboarding_completed?: boolean | null } | null)?.onboarding_completed
  );
  const sp = await searchParams;
  const next = sp.next ?? "";
  if (onboardingCompleted) redirect(next && next.startsWith("/") ? next : "/home");

  // Prellena el número si el perfil ya tenía uno válido. El jugador igual tiene
  // que confirmarlo en el paso 4.
  const initialPhone = normalizeArMobile((profile as { phone?: string | null } | null)?.phone ?? "");

  return (
    <CompletarPerfilClient
      next={next}
      googleAvatarUrl={user.user_metadata?.avatar_url ?? null}
      initialPhone={initialPhone}
    />
  );
}
