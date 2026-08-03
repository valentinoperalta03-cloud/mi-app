import { NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { getPreApprovalClient } from "@/lib/mercadopago";
import { getPublicBaseUrl } from "@/lib/mp-preference";
import { createClient, createServiceClient } from "@/utils/supabase/server";

const SUBSCRIPTION_PRICE_ARS = 50000;

/**
 * La API de preapproval de Mercado Pago rechaza `reason` con tildes/ñ (a veces
 * con 400 "Parameters passed are invalid", a veces con 500 "Internal server
 * error" — inconsistente pero siempre falla). Se remueven diacríticos antes
 * de enviarlo; el nombre del club puede traer acentos.
 */
function toAsciiReason(value: string): string {
  return value.normalize("NFD").replace(/[^\x00-\x7F]/g, "");
}

export async function POST(req: Request) {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { clubId?: string };
  const clubId = String(body.clubId ?? "").trim();
  if (!clubId) {
    return NextResponse.json({ error: "clubId requerido." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: club, error: clubErr } = await service
    .from(DB_TABLES.clubs)
    .select("id, name, owner_id, subscription_status, mp_subscription_id")
    .eq("id", clubId)
    .maybeSingle();
  const clubRow = club as {
    id?: string;
    name?: string | null;
    owner_id?: string | null;
    subscription_status?: string | null;
    mp_subscription_id?: string | null;
  } | null;

  if (clubErr || !clubRow) {
    return NextResponse.json({ error: "Club no encontrado." }, { status: 404 });
  }
  if (clubRow.owner_id !== user.id) {
    return NextResponse.json({ error: "No tenés permiso sobre este club." }, { status: 403 });
  }
  if (clubRow.subscription_status === "active") {
    return NextResponse.json({ error: "El club ya tiene una suscripción activa." }, { status: 409 });
  }

  const base = getPublicBaseUrl();

  const existingId = String(clubRow.mp_subscription_id ?? "").trim();
  if (existingId) {
    let existingStatus: string | null = null;
    try {
      const res = await fetch(`https://api.mercadopago.com/preapproval/${existingId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { status?: string };
        existingStatus = String(data.status ?? "").toLowerCase();
      }
    } catch (e) {
      log.error({ event: "mp.subscription.existing_check_failed", clubId, existingId, err: e });
    }

    if (existingStatus === "authorized") {
      return NextResponse.json({
        subscriptionUrl: `${base}/admin/facturacion/callback?preapproval_id=${existingId}`,
      });
    }

    // pending, cancelled, estado desconocido, o el GET falló: la preapproval quedó
    // huérfana (el club abandonó el flujo de MP sin completar). La limpiamos antes
    // de generar una nueva para no acumular IDs sueltos en clubs.mp_subscription_id.
    await service.from(DB_TABLES.clubs).update({ mp_subscription_id: null }).eq("id", clubId);
  }

  try {
    // El SDK oficial (mercadopago) no tipa `free_trial` en el request de
    // PreApproval.create pese a que la API de MP si lo acepta; se tipa acá
    // localmente en vez de castear a `any`.
    const preApprovalBody: {
      reason: string;
      external_reference: string;
      payer_email: string;
      back_url?: string;
      auto_recurring: {
        frequency: number;
        frequency_type: string;
        transaction_amount: number;
        currency_id: string;
        free_trial: { frequency: number; frequency_type: string };
      };
      status: string;
    } = {
      reason: toAsciiReason(`Suscripcion mensual PadeLibre - ${clubRow.name ?? "Club"}`),
      external_reference: clubId,
      // MP exige payer_email para crear el preapproval (sin él devuelve 400
      // "payer_email is required"); el dueño del club es quien la activa.
      payer_email: user.email ?? "",
      ...(base ? { back_url: `${base}/admin/facturacion/callback` } : {}),
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: SUBSCRIPTION_PRICE_ARS,
        currency_id: "ARS",
        free_trial: { frequency: 15, frequency_type: "days" },
      },
      status: "pending",
    };

    const preApproval = await getPreApprovalClient().create({ body: preApprovalBody });

    if (!preApproval.init_point || !preApproval.id) {
      return NextResponse.json(
        { error: "Mercado Pago no devolvió un link de suscripción válido." },
        { status: 502 }
      );
    }

    await service.from(DB_TABLES.clubs).update({ mp_subscription_id: preApproval.id }).eq("id", clubId);

    return NextResponse.json({ subscriptionUrl: preApproval.init_point });
  } catch (e) {
    const mpStatus = e != null && typeof e === "object" && "status" in e ? (e as { status?: unknown }).status : undefined;
    log.error({ event: "mp.subscription.create_failed", clubId, mpStatus, err: e });
    return NextResponse.json(
      { error: "No se pudo crear la suscripción. Intentá de nuevo." },
      { status: 502 }
    );
  }
}
