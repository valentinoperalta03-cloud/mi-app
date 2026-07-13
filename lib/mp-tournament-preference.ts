import { MercadoPagoConfig, Preference } from "mercadopago";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { createServiceClient } from "@/utils/supabase/server";

export function tournamentExternalReference(registrationId: string, payerUserId: string): string {
  return `tournament_reg_${registrationId}__${payerUserId}`;
}

export function parseTournamentRegistrationRef(ref: string): { registrationId: string; payerUserId: string } | null {
  const trimmed = String(ref ?? "").trim();
  const prefix = "tournament_reg_";
  if (!trimmed.startsWith(prefix)) return null;
  const rest = trimmed.slice(prefix.length);
  const sep = "__";
  const idx = rest.indexOf(sep);
  if (idx <= 0) return null;
  const registrationId = rest.slice(0, idx).trim();
  const payerUserId = rest.slice(idx + sep.length).trim();
  if (!registrationId || !payerUserId) return null;
  return { registrationId, payerUserId };
}

function getPublicBaseUrl(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (site) return site;
  const v = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (v) return v.startsWith("http") ? v : `https://${v}`;
  return "";
}

/**
 * Preferencia MP para inscripción a torneo: `unit_price` = price_per_pair del
 * torneo, sin fee de plataforma. El 100% va a la cuenta del club.
 */
export async function createTournamentMercadoPagoPreference(params: {
  tournamentId: string;
  registrationId: string;
  payerUserId: string;
  clubName: string;
  tournamentName: string;
  /** Precio que recibe el club por la pareja. */
  clubPricePerPair: number;
  payerEmail?: string;
  payerFirstName?: string;
  payerLastName?: string;
  backUrls?: { success: string; failure: string; pending: string };
}): Promise<{ error: string } | { prefId: string; initPoint: string; total: number }> {
  const service = createServiceClient();
  const { data: t } = await service
    .from(DB_TABLES.tournaments)
    .select("id, club_id, name")
    .eq("id", params.tournamentId)
    .maybeSingle();
  if (!t) return { error: "Torneo no encontrado." };

  const { data: club } = await service
    .from(DB_TABLES.clubs)
    .select("name, mp_access_token")
    .eq("id", (t as { club_id: string }).club_id)
    .maybeSingle();
  const clubTyped = club as { name?: string | null; mp_access_token?: string | null } | null;
  const clubToken = String(clubTyped?.mp_access_token ?? "").trim();
  if (!clubToken) return { error: "El club no tiene Mercado Pago configurado." };

  const clubPrice = Number(params.clubPricePerPair);
  if (!Number.isFinite(clubPrice) || clubPrice <= 0) return { error: "Precio inválido." };

  const total = clubPrice;

  const successUrl = params.backUrls?.success ?? process.env.MP_SUCCESS_URL;
  const failureUrl = params.backUrls?.failure ?? process.env.MP_FAILURE_URL;
  const pendingUrl = params.backUrls?.pending ?? process.env.MP_PENDING_URL;
  if (!successUrl || !failureUrl || !pendingUrl) {
    return { error: "Falta configuración de URLs de retorno de Mercado Pago." };
  }

  const base = getPublicBaseUrl();
  const notificationUrl = base ? `${base}/api/mp/webhook` : undefined;
  const externalReference = tournamentExternalReference(params.registrationId, params.payerUserId);
  const preferenceClient = new Preference(new MercadoPagoConfig({ accessToken: clubToken }));
  const clubName = String(clubTyped?.name ?? params.clubName ?? "Club").trim() || "Club";
  const title = `Torneo — ${String((t as { name?: string }).name ?? params.tournamentName).trim()}`;

  try {
    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: params.tournamentId,
            title,
            description: `Inscripción · ${clubName}`,
            quantity: 1,
            unit_price: total,
            currency_id: "ARS",
            category_id: "others",
          },
        ],
        payer: {
          email: params.payerEmail,
        },
        statement_descriptor: "PADELIBRE",
        back_urls: {
          success: successUrl,
          failure: failureUrl,
          pending: pendingUrl,
        },
        auto_return: "approved" as const,
        external_reference: externalReference,
        binary_mode: false,
        ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      },
    });

    const initPoint = preference.init_point ?? preference.sandbox_init_point;
    const prefId = preference.id;
    if (!prefId || !initPoint) {
      return { error: "La respuesta de Mercado Pago fue incompleta." };
    }
    return { prefId, initPoint, total };
  } catch (e) {
    log.error({ event: "mp.tournament.preference_failed", tournamentId: params.tournamentId, err: e });
    return { error: "Mercado Pago no pudo crear el pago. Intentá más tarde." };
  }
}
