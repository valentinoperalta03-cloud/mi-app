import { MercadoPagoConfig, Preference } from "mercadopago";
import { log } from "@/lib/logger";

export function getPublicBaseUrl(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (site) return site;
  const v = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (v) return v.startsWith("http") ? v : `https://${v}`;
  return "";
}

/**
 * Crea una preferencia de MP por `amount` (seña o precio completo, ya calculado
 * por el caller). El 100% va a la cuenta del club: no hay marketplace_fee.
 */
export async function createMPPreference(params: {
  matchId: string;
  amount: number;
  clubName: string;
  courtName: string;
  date: string;
  userId: string;
  /** Mercado Pago external_reference; default `{matchId}` para reservas legacy. */
  externalReference?: string;
  payerEmail?: string;
  payerFirstName?: string;
  payerLastName?: string;
  clubAccessToken?: string | null;
  /** Si se pasa, reemplaza MP_SUCCESS_URL / FAILURE / PENDING (ej. confirmación de partido). */
  backUrls?: { success: string; failure: string; pending: string };
}): Promise<{ error: string } | { prefId: string; initPoint: string; total: number }> {
  const successUrl = params.backUrls?.success ?? process.env.MP_SUCCESS_URL;
  const failureUrl = params.backUrls?.failure ?? process.env.MP_FAILURE_URL;
  const pendingUrl = params.backUrls?.pending ?? process.env.MP_PENDING_URL;

  const amount = Number(params.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Datos de pago inválidos." };
  }
  if (!successUrl || !failureUrl || !pendingUrl) {
    return { error: "Falta configuración de Mercado Pago en el servidor." };
  }

  const clubToken = String(params.clubAccessToken ?? "").trim();
  if (!clubToken) {
    return { error: "El club no tiene Mercado Pago configurado." };
  }

  const base = getPublicBaseUrl();
  const notificationUrl = base ? `${base}/api/mp/webhook` : undefined;
  const preferenceClient = new Preference(new MercadoPagoConfig({ accessToken: clubToken }));

  try {
    const preferenceBody = {
      items: [
        {
          id: params.matchId,
          title: `Reserva de pádel - ${params.courtName}`,
          description: `Reserva en ${params.clubName} el ${params.date}`,
          quantity: 1,
          unit_price: amount,
          currency_id: "ARS",
          category_id: "sports",
        },
      ],
      payer: {
        email: params.payerEmail,
        first_name: params.payerFirstName ?? "",
        last_name: params.payerLastName ?? "",
      },
      statement_descriptor: "PADELIBRE",
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      auto_return: "approved" as const,
      external_reference: params.externalReference ?? params.matchId,
      binary_mode: false,
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    };
    const preference = await preferenceClient.create({
      body: preferenceBody as Parameters<typeof preferenceClient.create>[0]["body"],
    });

    const initPoint = preference.init_point ?? preference.sandbox_init_point;
    const prefId = preference.id;
    if (!prefId || !initPoint) {
      return { error: "La respuesta de Mercado Pago fue incompleta. Intentá de nuevo." };
    }

    return { prefId, initPoint, total: amount };
  } catch (e) {
    log.error({ event: "mp.preference.create_failed", matchId: params.matchId, err: e });
    return {
      error:
        "Mercado Pago no pudo crear el pago en este momento. Intentá de nuevo en unos minutos o contactá soporte.",
    };
  }
}
