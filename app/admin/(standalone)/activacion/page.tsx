import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import ActivacionView from "./activacion-view";

export default async function ActivacionPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const clubId = ctx.clubIds[0] ?? "";
  if (!clubId) redirect("/login");

  // subscription_status esta revocada para authenticated: se lee con service client.
  const { data: clubRow } = await createServiceClient()
    .from(DB_TABLES.clubs)
    .select("subscription_status")
    .eq("id", clubId)
    .maybeSingle();
  const status = (clubRow as { subscription_status?: string | null } | null)?.subscription_status;

  if (status && status !== "pending") {
    redirect("/admin/dashboard");
  }

  const clubName = ctx.clubs[0]?.name ?? "tu club";

  return <ActivacionView clubName={clubName} clubId={clubId} />;
}
