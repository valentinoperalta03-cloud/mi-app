import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { getPreferenceClient } from "@/lib/mercadopago";

type Body = {
  match_id?: string;
  amount?: number;
  club_name?: string;
  court_name?: string;
  date?: string;
};

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

export async function POST(req: Request) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    const successUrl = process.env.MP_SUCCESS_URL;
    const failureUrl = process.env.MP_FAILURE_URL;
    const pendingUrl = process.env.MP_PENDING_URL;
    if (!accessToken || !successUrl || !failureUrl || !pendingUrl) {
      return NextResponse.json(
        { error: "Falta configuración de Mercado Pago en el servidor." },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options: opts }) =>
              cookieStore.set(name, value, opts)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const json = (await req.json().catch((err) => {
      log.warn({ event: "mp.create_preference.body_parse", err });
      return {};
    })) as Body;
    const matchId = String(json.match_id ?? "").trim();
    const amount = Number(json.amount);
    const clubName = String(json.club_name ?? "Club").trim() || "Club";
    const courtName = String(json.court_name ?? "Cancha").trim() || "Cancha";
    const dateLabel = String(json.date ?? "").trim();

    if (!matchId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Datos de pago inválidos." }, { status: 400 });
    }

    const { data: match, error: matchErr } = await supabase
      .from(DB_TABLES.matches)
      .select("id, owner_id")
      .eq("id", matchId)
      .maybeSingle();

    if (matchErr || !match || (match as { owner_id: string }).owner_id !== user.id) {
      return NextResponse.json({ error: "No se encontró el partido o no tenés permiso." }, { status: 403 });
    }

    const feeRate = parseFeeRate();
    const marketplaceFee = Math.round(amount * feeRate * 100) / 100;
    const total = Math.round((amount + marketplaceFee) * 100) / 100;

    const base = getPublicBaseUrl();
    const notificationUrl = base ? `${base}/api/mp/webhook` : undefined;

    let preference: { id?: string; init_point?: string; sandbox_init_point?: string };
    try {
      log.info({ event: "mp.preference.create_attempt", userId: user.id, matchId });
      preference = await getPreferenceClient().create({
        body: {
          items: [
            {
              id: matchId,
              title: `Reserva ${courtName} - ${clubName}${dateLabel ? ` (${dateLabel})` : ""}`,
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
    } catch (e) {
      log.error({ event: "mp.preference.create_failed", userId: user.id, matchId, err: e });
      return NextResponse.json(
        {
          error:
            "Mercado Pago no pudo crear el pago en este momento. Intentá de nuevo en unos minutos o contactá soporte.",
        },
        { status: 502 }
      );
    }

    const prefId = preference.id;
    const initPoint = preference.init_point ?? preference.sandbox_init_point;
    if (!prefId || !initPoint) {
      return NextResponse.json(
        { error: "La respuesta de Mercado Pago fue incompleta. Intentá de nuevo." },
        { status: 502 }
      );
    }

    const { error: payErr } = await supabase.from(DB_TABLES.payments).insert({
      match_id: matchId,
      user_id: user.id,
      mp_preference_id: prefId,
      status: "pending",
      amount: total,
      marketplace_fee: marketplaceFee,
    });

    if (payErr) {
      log.error({ event: "mp.payment.insert_failed", userId: user.id, matchId, err: payErr });
      return NextResponse.json(
        { error: "No se pudo registrar el pago. Intentá de nuevo." },
        { status: 500 }
      );
    }

    return NextResponse.json({ preference_id: prefId, init_point: initPoint });
  } catch (e) {
    log.error({ event: "mp.create_preference.unhandled", err: e });
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
