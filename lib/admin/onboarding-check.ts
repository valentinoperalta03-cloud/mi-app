import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

export type OnboardingItems = {
  datos_club: boolean;
  fotos: boolean;
  horarios: boolean;
  canchas: boolean;
  precios: boolean;
  metodos_pago: boolean;
  politica_cancelacion: boolean;
  sena: boolean;
};

function hasValidBusinessHours(raw: string | null | undefined): boolean {
  const s = String(raw ?? "").trim();
  if (!s) return false;
  return /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/.test(s);
}

function hasClubWallTimes(open: string | null | undefined, close: string | null | undefined): boolean {
  const o = String(open ?? "").trim();
  const c = String(close ?? "").trim();
  if (!o || !c) return false;
  return /^\d{1,2}:\d{2}/.test(o) && /^\d{1,2}:\d{2}/.test(c);
}

type ClubOnboardingRow = {
  name: string | null;
  description: string | null;
  address: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  business_hours: string | null;
  open_time: string | null;
  close_time: string | null;
  cancellation_policy: string | null;
  accepts_cash: boolean | null;
  accepts_transfer: boolean | null;
  bank_alias: string | null;
  onboarding_completed: boolean | null;
  deposit_value: number | null;
};

/**
 * Estado de onboarding para un club (checklist y si puede recibir reservas).
 * Horarios: `clubs.open_time` / `clubs.close_time` (preferido) o texto `business_hours` legacy.
 */
export async function checkOnboardingStatus(supabase: SupabaseClient, clubId: string) {
  const { data: club, error: clubErr } = await supabase
    .from(DB_TABLES.clubs)
    .select(
      "name, description, address, whatsapp, logo_url, cover_image_url, business_hours, open_time, close_time, cancellation_policy, accepts_cash, accepts_transfer, bank_alias, onboarding_completed, deposit_value"
    )
    .eq("id", clubId)
    .maybeSingle();

  if (clubErr || !club) {
    const emptyItems: OnboardingItems = {
      datos_club: false,
      fotos: false,
      horarios: false,
      canchas: false,
      precios: false,
      metodos_pago: false,
      politica_cancelacion: false,
      sena: false,
    };
    return {
      items: emptyItems,
      completedCount: 0,
      totalCount: 8,
      allCompleted: false,
      canReceiveReservations: false,
      club: null,
      onboardingCompleted: false,
    };
  }

  const c = club as ClubOnboardingRow;

  // mp_access_token esta revocada para anon/authenticated: se lee aparte con service client.
  const { data: mpRow } = await createServiceClient()
    .from(DB_TABLES.clubs)
    .select("mp_access_token")
    .eq("id", clubId)
    .maybeSingle();
  const hasMpConnected = Boolean(
    String((mpRow as { mp_access_token?: string | null } | null)?.mp_access_token ?? "").trim()
  );

  const { data: courts } = await supabase.from(DB_TABLES.courts).select("id, price").eq("club_id", clubId);

  const courtList = (courts ?? []) as Array<{ id: string; price: number | null }>;
  const hasCourts = courtList.length > 0;
  const hasPrices = courtList.some((row) => Number(row.price ?? 0) > 0);

  const items: OnboardingItems = {
    datos_club: Boolean(
      String(c.name ?? "").trim() &&
        String(c.description ?? "").trim() &&
        String(c.address ?? "").trim() &&
        String(c.whatsapp ?? "").trim()
    ),
    fotos: Boolean(String(c.logo_url ?? "").trim() && String(c.cover_image_url ?? "").trim()),
    horarios: hasClubWallTimes(c.open_time, c.close_time) || hasValidBusinessHours(c.business_hours),
    canchas: hasCourts,
    precios: hasPrices,
    metodos_pago: Boolean(c.accepts_cash || c.accepts_transfer || hasMpConnected),
    politica_cancelacion: Boolean(String(c.cancellation_policy ?? "").trim()),
    sena: Number(c.deposit_value ?? 0) > 0,
  };

  const completedCount = Object.values(items).filter(Boolean).length;
  const totalCount = 8;
  const allCompleted = completedCount === totalCount;

  const canReceiveReservations = Boolean(
    items.datos_club && items.canchas && items.precios && items.horarios && items.metodos_pago
  );

  return {
    items,
    completedCount,
    totalCount,
    allCompleted,
    canReceiveReservations,
    club: c,
    onboardingCompleted: Boolean(c.onboarding_completed),
  };
}
