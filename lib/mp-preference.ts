import { MercadoPagoConfig, Preference } from "mercadopago";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { createServiceClient } from "@/utils/supabase/server";

function parseFeeRate(): number {
  const raw = process.env.MP_MARKETPLACE_FEE ?? "0.05";
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0.05;
}

function clockToMinutes(clock: string): number {
  const s = clock.trim().slice(0, 5);
  const [h, m] = s.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

export function getPublicBaseUrl(): string {
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
  /** Mercado Pago external_reference; default `{matchId}` for reservas legacy. */
  externalReference?: string;
  payerEmail?: string;
  payerFirstName?: string;
  payerLastName?: string;
  clubAccessToken?: string | null;
  clubMpUserId?: string | null;
  /** Si se pasa, reemplaza MP_SUCCESS_URL / FAILURE / PENDING (ej. confirmación de partido). */
  backUrls?: { success: string; failure: string; pending: string };
}): Promise<
  | { error: string }
  | { prefId: string; initPoint: string; total: number; marketplaceFee: number }
> {
  let rawAmount = params.amount;
  const accessToken = process.env.MP_ACCESS_TOKEN;
  const successUrl = params.backUrls?.success ?? process.env.MP_SUCCESS_URL;
  const failureUrl = params.backUrls?.failure ?? process.env.MP_FAILURE_URL;
  const pendingUrl = params.backUrls?.pending ?? process.env.MP_PENDING_URL;

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
    const hMin = clockToMinutes(hour);
    let override = 0;

    if (Number.isFinite(hMin)) {
      const { data: bandRows } = await service
        .from(DB_TABLES.courtSchedules)
        .select("price_override,start_time,end_time")
        .eq("court_id", matchTyped.court_id)
        .is("day_of_week", null)
        .not("range_name", "is", null)
        .not("price_override", "is", null);

      for (const row of (bandRows ?? []) as Array<{
        price_override: number | null;
        start_time: string | null;
        end_time: string | null;
      }>) {
        const s = clockToMinutes(String(row.start_time ?? ""));
        const e = clockToMinutes(String(row.end_time ?? ""));
        if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
        const inRange = e > s ? hMin >= s && hMin < e : hMin >= s || hMin < e;
        if (inRange) {
          override = Number(row.price_override ?? 0);
          break;
        }
      }
    }

    if (!Number.isFinite(override) || override <= 0) {
      const { data: legacy } = await service
        .from(DB_TABLES.courtSchedules)
        .select("price_override")
        .eq("court_id", matchTyped.court_id)
        .eq("start_time", hour)
        .not("price_override", "is", null)
        .maybeSingle();
      override = Number((legacy as { price_override: number | null } | null)?.price_override ?? 0);
    }

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
  const clubToken = String(params.clubAccessToken ?? "").trim();
  if (!clubToken) {
    return { error: "El club no tiene Mercado Pago configurado." };
  }
  const preferenceClient = new Preference(new MercadoPagoConfig({ accessToken: clubToken }));

  try {
    const preferenceBody = {
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

    return { prefId, initPoint, total, marketplaceFee };
  } catch (e) {
    log.error({ event: "mp.preference.create_failed", matchId: params.matchId, err: e });
    return {
      error:
        "Mercado Pago no pudo crear el pago en este momento. Intentá de nuevo en unos minutos o contactá soporte.",
    };
  }
}
