import { getPreferenceClient } from "@/lib/mercadopago";

function parseFeeRate(): number {
  const raw = process.env.MP_MARKETPLACE_FEE ?? "0.05";
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0.05;
}

function getPublicBaseUrl(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (site) return site;
  const v = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (v) return v.startsWith("http") ? v : `https://${v}`;
  return "";
}

export async function createMPPreference(params: {
  matchId: string;
  amount: number;
  clubName: string;
  courtName: string;
  date: string;
  userId: string;
}): Promise<
  | { error: string }
  | { prefId: string; initPoint: string; total: number; marketplaceFee: number }
> {
  const { matchId, amount: rawAmount, clubName, courtName, date } = params;
  const accessToken = process.env.MP_ACCESS_TOKEN;
  const successUrl = process.env.MP_SUCCESS_URL;
  const failureUrl = process.env.MP_FAILURE_URL;
  const pendingUrl = process.env.MP_PENDING_URL;

  if (!accessToken || !successUrl || !failureUrl || !pendingUrl) {
    return { error: "Falta configuración de Mercado Pago en el servidor." };
  }

  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Datos de pago inválidos." };
  }

  const feeRate = parseFeeRate();
  const marketplaceFee = Math.round(amount * feeRate * 100) / 100;
  const total = Math.round((amount + marketplaceFee) * 100) / 100;

  const base = getPublicBaseUrl();
  const notificationUrl = base ? `${base}/api/mp/webhook` : undefined;

  const dateLabel = String(date ?? "").trim();
  const title = `Reserva ${courtName} - ${clubName}${dateLabel ? ` (${dateLabel})` : ""}`;

  try {
    const preference = await getPreferenceClient().create({
      body: {
        items: [
          {
            id: matchId,
            title,
            quantity: 1,
            unit_price: total,
            currency_id: "ARS",
          },
        ],
        marketplace_fee: marketplaceFee,
        back_urls: {
          success: successUrl,
          failure: failureUrl,
          pending: pendingUrl,
        },
        auto_return: "approved",
        external_reference: matchId,
        ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      },
    });

    const initPoint = preference.init_point ?? preference.sandbox_init_point;
    const prefId = preference.id;
    if (!prefId || !initPoint) {
      return { error: "La respuesta de Mercado Pago fue incompleta. Intentá de nuevo." };
    }

    return { prefId, initPoint, total, marketplaceFee };
  } catch (e) {
    console.error("[mp] create preference", e);
    return {
      error:
        "Mercado Pago no pudo crear el pago en este momento. Intentá de nuevo en unos minutos o contactá soporte.",
    };
  }
}
