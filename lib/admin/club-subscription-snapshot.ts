import "server-only";
import { cache } from "react";
import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

export type ClubSubscriptionSnapshot = {
  subscription_status?: string | null;
  trial_end_date?: string | null;
  grace_period_end?: string | null;
  last_status_detail?: string | null;
};

/**
 * Campos de suscripción compartidos por TrialBanner y PastDueBanner.
 * Estas columnas están revocadas para authenticated, por eso usa el service client.
 * `clubId` debe venir de getOwnerAdminContext, nunca del cliente.
 * React.cache: dedupe solo dentro del mismo request; no convertir a cache persistente.
 */
export const getClubSubscriptionSnapshot = cache(
  async (clubId: string): Promise<ClubSubscriptionSnapshot | null> => {
    const service = createServiceClient();
    const { data } = await service
      .from(DB_TABLES.clubs)
      .select("subscription_status, trial_end_date, grace_period_end, last_status_detail")
      .eq("id", clubId)
      .maybeSingle();
    return data as ClubSubscriptionSnapshot | null;
  }
);
