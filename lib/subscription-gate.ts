import { DB_TABLES } from "@/lib/db-tables";
import {
  signSubscriptionCookie,
  verifySubscriptionCookie,
} from "@/lib/club-subscription-cookie";
import { createServiceClient } from "@/utils/supabase/server";

export type SubscriptionBlockReason = "pending" | "trial_expired" | "past_due" | "paused";

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
  let gracePeriodEnd: string | null;
  let refreshedCookieValue: string | null = null;

  if (cached) {
    status = cached.status;
    trialEndDate = cached.trialEndDate;
    gracePeriodEnd = cached.gracePeriodEnd;
  } else {
    try {
      const service = createServiceClient();
      const { data, error } = await service
        .from(DB_TABLES.clubs)
        .select("subscription_status, trial_end_date, grace_period_end")
        .eq("id", clubId)
        .maybeSingle();
      if (error || !data) {
        return { blockReason: null, refreshedCookieValue: null };
      }
      const row = data as {
        subscription_status?: string | null;
        trial_end_date?: string | null;
        grace_period_end?: string | null;
      };
      status = row.subscription_status ?? "trial";
      trialEndDate = row.trial_end_date ?? null;
      gracePeriodEnd = row.grace_period_end ?? null;
      refreshedCookieValue = signSubscriptionCookie({ clubId, status, trialEndDate, gracePeriodEnd });
    } catch {
      return { blockReason: null, refreshedCookieValue: null };
    }
  }

  let blockReason: SubscriptionBlockReason | null = null;
  if (status === "pending") {
    blockReason = "pending";
  } else if (status === "trial") {
    if (trialEndDate && Date.now() > new Date(trialEndDate).getTime()) {
      blockReason = "trial_expired";
    }
  } else if (status === "trial_expired") {
    blockReason = "trial_expired";
  } else if (status === "past_due") {
    // Grace period propio de PadeLibre (7 dias desde el primer rechazo): el
    // club sigue con acceso al panel mientras no venza grace_period_end. Sin
    // esa fecha (caso raro/legacy) se bloquea por seguridad.
    if (!gracePeriodEnd || Date.now() > new Date(gracePeriodEnd).getTime()) {
      blockReason = "past_due";
    }
  } else if (status === "paused") {
    blockReason = "paused";
  }

  return { blockReason, refreshedCookieValue };
}
