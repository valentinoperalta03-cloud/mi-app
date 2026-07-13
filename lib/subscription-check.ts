import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

/**
 * subscription_status solo es legible por service_role (columna revocada para
 * anon/authenticated), por eso esta consulta usa el service client.
 */
export async function isClubSubscriptionBlocked(clubId: string): Promise<boolean> {
  const service = createServiceClient();
  const { data } = await service
    .from(DB_TABLES.clubs)
    .select("subscription_status")
    .eq("id", clubId)
    .maybeSingle();
  const status = String(
    (data as { subscription_status?: string | null } | null)?.subscription_status ?? "trial"
  );
  return status === "past_due" || status === "paused";
}
