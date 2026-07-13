import { DB_TABLES } from "@/lib/db-tables";
import {
  signSubscriptionCookie,
  verifySubscriptionCookie,
} from "@/lib/club-subscription-cookie";
import { createServiceClient } from "@/utils/supabase/server";

export type SubscriptionBlockReason = "trial_expired" | "past_due" | "paused";

export type SubscriptionGateResult = {
  blockReason: SubscriptionBlockReason | null;
  /** Si se refresco desde Supabase (cookie ausente/vencida), el valor firmado a guardar. */
  refreshedCookieValue: string | null;
};

/**
 * subscription_status/trial_end_date estan revocadas para anon/authenticated
 * (ver migracion de clubs), por eso esta consulta usa el service client.
 * Fail-open: cualquier error de Supabase deja pasar al usuario sin bloquear.
 */
export async function evaluateClubSubscriptionGate(
  cachedCookieValue: string | undefined,
  clubId: string
): Promise<SubscriptionGateResult> {
  const cached = verifySubscriptionCookie(cachedCookieValue, clubId);

  let status: string;
  let trialEndDate: string | null;
  let refreshedCookieValue: string | null = null;

  if (cached) {
    status = cached.status;
    trialEndDate = cached.trialEndDate;
  } else {
    try {
      const service = createServiceClient();
      const { data, error } = await service
        .from(DB_TABLES.clubs)
        .select("subscription_status, trial_end_date")
        .eq("id", clubId)
        .maybeSingle();
      if (error || !data) {
        return { blockReason: null, refreshedCookieValue: null };
      }
      const row = data as { subscription_status?: string | null; trial_end_date?: string | null };
      status = row.subscription_status ?? "trial";
      trialEndDate = row.trial_end_date ?? null;
      refreshedCookieValue = signSubscriptionCookie({ clubId, status, trialEndDate });
    } catch {
      return { blockReason: null, refreshedCookieValue: null };
    }
  }

  let blockReason: SubscriptionBlockReason | null = null;
  if (status === "trial") {
    if (trialEndDate && Date.now() > new Date(trialEndDate).getTime()) {
      blockReason = "trial_expired";
    }
  } else if (status === "past_due") {
    blockReason = "past_due";
  } else if (status === "paused") {
    blockReason = "paused";
  }

  return { blockReason, refreshedCookieValue };
}
