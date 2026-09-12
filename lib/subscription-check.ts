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
    .select("subscription_status, trial_end_date, grace_period_end")
    .eq("id", clubId)
    .maybeSingle();
  const row = data as {
    subscription_status?: string | null;
    trial_end_date?: string | null;
    grace_period_end?: string | null;
  } | null;
  const status = String(row?.subscription_status ?? "trial");

  // Trial vencido por fecha aunque el status todavia no se haya actualizado
  // (el cron de expire-trials corre una vez por dia, ver app/api/cron/expire-trials).
  if (status === "trial" && row?.trial_end_date && new Date(row.trial_end_date) < new Date()) {
    return true;
  }

  // past_due tiene grace period propio de 7 dias (ver
  // lib/mp-handlers/subscription-webhook-handler.ts): solo bloquea si
  // grace_period_end ya paso (o no existe, caso raro/legacy).
  if (status === "past_due") {
    return !row?.grace_period_end || new Date(row.grace_period_end) < new Date();
  }

  return status === "paused" || status === "trial_expired";
}
