import { NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { getPreApprovalClient } from "@/lib/mercadopago";
import { getPublicBaseUrl } from "@/lib/mp-preference";
import { createClient, createServiceClient } from "@/utils/supabase/server";

const SUBSCRIPTION_PRICE_ARS = 50000;

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

  const { data: authUser } = await service.auth.admin.getUserById(user.id);
  const payerEmail = authUser?.user?.email;
  if (!payerEmail) {
    return NextResponse.json(
      { error: "No se pudo obtener el email del dueño del club." },
      { status: 500 }
    );
  }

  try {
    const preApproval = await getPreApprovalClient().create({
      body: {
        reason: `Suscripción mensual PadeLibre - ${clubRow.name ?? "Club"}`,
        external_reference: clubId,
        payer_email: payerEmail,
        ...(base ? { back_url: `${base}/admin/facturacion/callback` } : {}),
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: SUBSCRIPTION_PRICE_ARS,
          currency_id: "ARS",
        },
        status: "pending",
      },
    });

    if (!preApproval.init_point || !preApproval.id) {
      return NextResponse.json(
        { error: "Mercado Pago no devolvió un link de suscripción válido." },
        { status: 502 }
      );
    }

    await service.from(DB_TABLES.clubs).update({ mp_subscription_id: preApproval.id }).eq("id", clubId);

    return NextResponse.json({ subscriptionUrl: preApproval.init_point });
  } catch (e) {
    log.error({ event: "mp.subscription.create_failed", clubId, err: e });
    return NextResponse.json(
      { error: "No se pudo crear la suscripción. Intentá de nuevo." },
      { status: 502 }
    );
  }
}
