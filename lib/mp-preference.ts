import { MercadoPagoConfig, Preference } from "mercadopago";
import { DB_TABLES } from "@/lib/db-tables";
import { getPreferenceClient } from "@/lib/mercadopago";
import { createServiceClient } from "@/utils/supabase/server";

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
  payerEmail?: string;
  payerFirstName?: string;
  payerLastName?: string;
  clubAccessToken?: string | null;
  clubMpUserId?: string | null;
}): Promise<
  | { error: string }
  | { prefId: string; initPoint: string; total: number; marketplaceFee: number }
> {
  let rawAmount = params.amount;
  const accessToken = process.env.MP_ACCESS_TOKEN;
  const successUrl = process.env.MP_SUCCESS_URL;
  const failureUrl = process.env.MP_FAILURE_URL;
  const pendingUrl = process.env.MP_PENDING_URL;

  if ((!accessToken && !params.clubAccessToken) || !successUrl || !failureUrl || !pendingUrl) {
    return { error: "Falta configuración de Mercado Pago en el servidor." };
  }

  const service = createServiceClient();
  const { data: match } = await service
    .from(DB_TABLES.matches)
    .select("court_id,scheduled_time")
    .eq("id", params.matchId)
    .maybeSingle();
  const matchTyped = match as { court_id: string | null; scheduled_time: string | null } | null;
  const hour = String(matchTyped?.scheduled_time ?? "").trim().slice(0, 5);
  if (matchTyped?.court_id && hour) {
    const { data: schedule } = await service
      .from(DB_TABLES.courtSchedules)
      .select("price_override")
      .eq("court_id", matchTyped.court_id)
      .eq("start_time", hour)
      .not("price_override", "is", null)
      .maybeSingle();
    const override = Number((schedule as { price_override: number | null } | null)?.price_override ?? 0);
    if (Number.isFinite(override) && override > 0) {
      rawAmount = override;
    }
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
  const preferenceClient = params.clubAccessToken
    ? new Preference(new MercadoPagoConfig({ accessToken: params.clubAccessToken }))
    : getPreferenceClient();

  try {
    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: params.matchId,
            title: `Reserva de pádel - ${params.courtName}`,
            description: `Reserva en ${params.clubName} el ${params.date}`,
            quantity: 1,
            unit_price: total,
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
        marketplace_fee: marketplaceFee,
        back_urls: {
          success: successUrl,
          failure: failureUrl,
          pending: pendingUrl,
        },
        auto_return: "approved",
        external_reference: params.matchId,
        binary_mode: false,
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
