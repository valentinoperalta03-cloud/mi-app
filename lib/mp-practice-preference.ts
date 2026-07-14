import { MercadoPagoConfig, Preference } from "mercadopago";
import { isClubMercadoPagoConnected } from "@/lib/club-mp";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { practicePriceBreakdown } from "@/lib/practice-pricing";
import { createServiceClient } from "@/utils/supabase/server";

export function practiceExternalReference(registrationId: string, payerUserId: string): string {
  return `practice_reg_${registrationId}__${payerUserId}`;
}

export function parsePracticeRegistrationRef(ref: string): { registrationId: string; payerUserId: string } | null {
  const trimmed = String(ref ?? "").trim();
  const prefix = "practice_reg_";
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
 * Preferencia MP para clase. `unit_price` es el precio base del club;
 * el 100% va a la cuenta del club, sin retención de plataforma.
 */
export async function createPracticeMercadoPagoPreference(params: {
  sessionId: string;
  registrationId: string;
  payerUserId: string;
  clubName: string;
  practiceTitle: string;
  payerEmail?: string;
  backUrls?: { success: string; failure: string; pending: string };
}): Promise<{ error: string } | { prefId: string; initPoint: string; total: number }> {
  const service = createServiceClient();
  const { data: session } = await service
    .from(DB_TABLES.practiceSessions)
    .select("id, practice_id, session_date")
    .eq("id", params.sessionId)
    .maybeSingle();
  if (!session) return { error: "Clase no encontrada." };

  const { data: practice } = await service
    .from(DB_TABLES.practices)
    .select("id, club_id, title, price_base")
    .eq("id", (session as { practice_id: string }).practice_id)
    .maybeSingle();
  if (!practice) return { error: "Práctica no encontrada." };

  const { data: club } = await service
    .from(DB_TABLES.clubs)
    .select("name, mp_access_token, mp_user_id")
    .eq("id", (practice as { club_id: string }).club_id)
    .maybeSingle();
  const clubTyped = club as { name?: string | null; mp_access_token?: string | null; mp_user_id?: string | null } | null;
  if (!isClubMercadoPagoConnected(clubTyped)) {
    return { error: "El club no tiene Mercado Pago conectado." };
  }
  const clubToken = String(clubTyped?.mp_access_token ?? "").trim();

  const { clubPriceBase } = practicePriceBreakdown(
    Number((practice as { price_base: number }).price_base)
  );
  if (!Number.isFinite(clubPriceBase) || clubPriceBase < 0) return { error: "Precio inválido." };
  if (clubPriceBase <= 0) return { error: "Esta clase no tiene precio para cobrar con Mercado Pago." };

  const successUrl = params.backUrls?.success ?? process.env.MP_SUCCESS_URL;
  const failureUrl = params.backUrls?.failure ?? process.env.MP_FAILURE_URL;
  const pendingUrl = params.backUrls?.pending ?? process.env.MP_PENDING_URL;
  if (!successUrl || !failureUrl || !pendingUrl) {
    return { error: "Falta configuración de URLs de retorno de Mercado Pago." };
  }

  const base = getPublicBaseUrl();
  const notificationUrl = base ? `${base}/api/mp/webhook` : undefined;
  const externalReference = practiceExternalReference(params.registrationId, params.payerUserId);
  const preferenceClient = new Preference(new MercadoPagoConfig({ accessToken: clubToken }));
  const clubName = String(clubTyped?.name ?? params.clubName ?? "Club").trim() || "Club";
  const title = `Clase — ${String((practice as { title?: string }).title ?? params.practiceTitle).trim()}`;
  const sessionDate = String((session as { session_date?: string }).session_date ?? "").trim();

  try {
    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: params.sessionId,
            title,
            description: `Inscripción · ${clubName}${sessionDate ? ` · ${sessionDate}` : ""}`,
            quantity: 1,
            unit_price: clubPriceBase,
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
    log.info({
      event: "mp.practice.preference_created",
      sessionId: params.sessionId,
      clubPriceBase,
    });
    return {
      prefId,
      initPoint,
      total: clubPriceBase,
    };
  } catch (e) {
    log.error({ event: "mp.practice.preference_failed", sessionId: params.sessionId, err: e });
    return { error: "Mercado Pago no pudo crear el pago. Intentá más tarde." };
  }
}
