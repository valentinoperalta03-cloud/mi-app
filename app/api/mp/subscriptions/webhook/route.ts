import { NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { verifyMpWebhookSignature } from "@/lib/mp-webhook-signature";
import { createServiceClient } from "@/utils/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const TRIAL_DURATION_MS = 15 * 24 * 60 * 60 * 1000;

function extractDataId(url: URL, body: unknown): { id: string | null; topic: string | null } {
  const topic = url.searchParams.get("topic") ?? url.searchParams.get("type");
  const qId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (qId) return { id: qId, topic };
  if (body && typeof body === "object") {
    const b = body as { type?: string; topic?: string; data?: { id?: string } };
    const id = b.data?.id != null ? String(b.data.id) : null;
    return { id, topic: b.type ?? b.topic ?? topic };
  }
  return { id: null, topic };
}

type ClubRefs = { clubId: string; preapprovalId: string };

function logIfClubNotFound(requestId: string, refs: ClubRefs, found: unknown) {
  if (found) return;
  const lookupField = refs.clubId ? `id=${refs.clubId}` : `mp_subscription_id=${refs.preapprovalId}`;
  log.warn({
    event: "mp.subscription.webhook.club_not_found",
    requestId,
    msg: `webhook: no se encontró club con ${lookupField} — evento ignorado`,
  });
}

async function updateClubSubscription(
  admin: SupabaseClient,
  refs: ClubRefs,
  patch: Record<string, unknown>,
  requestId: string
) {
  const query = admin.from(DB_TABLES.clubs).update(patch);
  const result = refs.clubId
    ? await query.eq("id", refs.clubId).select("owner_id").maybeSingle()
    : await query.eq("mp_subscription_id", refs.preapprovalId).select("owner_id").maybeSingle();

  if (!result.error) {
    logIfClubNotFound(requestId, refs, result.data);
  }
  return result;
}

async function findClubByRefs(admin: SupabaseClient, refs: ClubRefs) {
  const query = admin.from(DB_TABLES.clubs).select("id, owner_id, subscription_status");
  return refs.clubId
    ? await query.eq("id", refs.clubId).maybeSingle()
    : await query.eq("mp_subscription_id", refs.preapprovalId).maybeSingle();
}

export async function POST(req: Request) {
  return handleNotification(req);
}

/** MP puede enviar GET en algunas configuraciones antiguas (igual que el webhook de pagos). */
export async function GET(req: Request) {
  return handleNotification(req);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}

async function handleNotification(req: Request) {
  const requestId = crypto.randomUUID();
  let body: unknown = null;
  if (req.headers.get("content-type")?.includes("application/json")) {
    body = await req.json().catch(() => null);
  }

  const url = new URL(req.url);
  const { id: dataId, topic } = extractDataId(url, body);
  if (!dataId) {
    return NextResponse.json({ ok: true });
  }

  if (!verifyMpWebhookSignature(req, dataId)) {
    log.warn({ event: "mp.subscription.webhook.invalid_signature", requestId, dataId });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    log.error({ event: "mp.subscription.webhook.no_token", requestId });
    return NextResponse.json({ ok: true });
  }

  const admin = createServiceClient();
  const normalizedTopic = String(topic ?? "").toLowerCase();

  if (normalizedTopic.includes("authorized_payment")) {
    const res = await fetch(`https://api.mercadopago.com/authorized_payments/${dataId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      log.error({
        event: "mp.subscription.webhook.authorized_payment_fetch_failed",
        requestId,
        status: res.status,
      });
      return NextResponse.json({ ok: true });
    }
    const payment = (await res.json()) as { status?: string; preapproval_id?: string };
    const preapprovalId = String(payment.preapproval_id ?? "").trim();
    const paymentStatus = String(payment.status ?? "").toLowerCase();
    if (!preapprovalId) return NextResponse.json({ ok: true });

    if (paymentStatus === "rejected") {
      const { data: updated, error } = await updateClubSubscription(
        admin,
        { clubId: "", preapprovalId },
        { subscription_status: "past_due" },
        requestId
      );
      if (error) {
        log.error({ event: "mp.subscription.webhook.update_failed", requestId, err: error });
        return NextResponse.json({ ok: false }, { status: 500 });
      }
      const ownerId = String((updated as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
      if (ownerId) {
        await createNotification(admin, {
          user_id: ownerId,
          type: "payment_rejected",
          title: "Pago de suscripción rechazado",
          body: "No pudimos cobrar tu suscripción mensual de PadeLibre. Actualizá tu medio de pago para evitar la suspensión.",
        });
      }
      log.info({ event: "mp.subscription.payment_failed", requestId, preapprovalId });
    } else if (paymentStatus === "approved") {
      // Cobro (inicial post-trial o recurrente mensual) aprobado: reactiva un
      // club que hubiera quedado en past_due y refresca next_billing_date.
      // Antes de este fix no se manejaba este status y el club quedaba
      // en past_due indefinidamente pese a que MP siguiera cobrando bien.
      const preRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!preRes.ok) {
        log.error({
          event: "mp.subscription.webhook.preapproval_fetch_failed",
          requestId,
          status: preRes.status,
        });
        return NextResponse.json({ ok: true });
      }
      const prePayload = (await preRes.json()) as { external_reference?: string; next_payment_date?: string };

      const { data: updated, error } = await updateClubSubscription(
        admin,
        { clubId: String(prePayload.external_reference ?? "").trim(), preapprovalId },
        {
          subscription_status: "active",
          next_billing_date: prePayload.next_payment_date ?? null,
          mp_subscription_id: preapprovalId,
        },
        requestId
      );
      if (error) {
        log.error({ event: "mp.subscription.webhook.update_failed", requestId, err: error });
        return NextResponse.json({ ok: false }, { status: 500 });
      }
      const ownerId = String((updated as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
      if (ownerId) {
        await createNotification(admin, {
          user_id: ownerId,
          type: "payment_approved",
          title: "Pago aprobado",
          body: "Tu pago mensual de PadeLibre fue procesado correctamente.",
        });
      }
      log.info({ event: "mp.subscription.payment_approved", requestId, preapprovalId });
    }
    return NextResponse.json({ ok: true });
  }

  const res = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    log.error({ event: "mp.subscription.webhook.preapproval_fetch_failed", requestId, status: res.status });
    return NextResponse.json({ ok: true });
  }
  const preapproval = (await res.json()) as {
    id?: string;
    status?: string;
    external_reference?: string;
    next_payment_date?: string;
  };

  const clubId = String(preapproval.external_reference ?? "").trim();
  const preapprovalId = String(preapproval.id ?? dataId).trim();
  const status = String(preapproval.status ?? "").toLowerCase();
  const refs: ClubRefs = { clubId, preapprovalId };

  if (status === "authorized") {
    // Necesitamos el subscription_status previo para distinguir "tarjeta
    // recien confirmada tras 'pending'" (arranca el trial de 15 dias) de
    // "reactivacion" (past_due/paused -> active), asi que se busca el club
    // antes de decidir el patch en vez de usar updateClubSubscription a ciegas.
    const { data: existingClub, error: findError } = await findClubByRefs(admin, refs);
    if (findError) {
      log.error({ event: "mp.subscription.webhook.lookup_failed", requestId, err: findError });
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    if (!existingClub) {
      logIfClubNotFound(requestId, refs, existingClub);
      return NextResponse.json({ ok: true });
    }
    const clubRow = existingClub as { id: string; owner_id: string | null; subscription_status: string | null };
    const isPendingActivation = clubRow.subscription_status === "pending";
    const now = new Date();
    const patch = isPendingActivation
      ? {
          subscription_status: "trial",
          trial_start_date: now.toISOString(),
          trial_end_date: new Date(now.getTime() + TRIAL_DURATION_MS).toISOString(),
          mp_subscription_id: preapprovalId,
        }
      : {
          subscription_status: "active",
          next_billing_date: preapproval.next_payment_date ?? null,
          mp_subscription_id: preapprovalId,
        };

    const { error } = await admin.from(DB_TABLES.clubs).update(patch).eq("id", clubRow.id);
    if (error) {
      log.error({ event: "mp.subscription.webhook.update_failed", requestId, err: error });
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    const ownerId = String(clubRow.owner_id ?? "").trim();
    if (ownerId) {
      await createNotification(admin, {
        user_id: ownerId,
        type: "payment_approved",
        title: isPendingActivation ? "¡Tarjeta confirmada!" : "¡Suscripción activada!",
        body: isPendingActivation
          ? "Tu período de prueba de 15 días empezó. No se te cobra nada hasta que termine."
          : "Tu suscripción mensual a PadeLibre quedó activa.",
      });
    }
    log.info({
      event: isPendingActivation ? "mp.subscription.trial_started" : "mp.subscription.authorized",
      requestId,
      clubId: clubRow.id,
      preapprovalId,
    });
  } else if (status === "cancelled" || status === "paused") {
    const { data: updated, error } = await updateClubSubscription(
      admin,
      refs,
      { subscription_status: "paused" },
      requestId
    );
    if (error) {
      log.error({ event: "mp.subscription.webhook.update_failed", requestId, err: error });
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    const ownerId = String((updated as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
    if (ownerId) {
      await createNotification(admin, {
        user_id: ownerId,
        type: "payment_rejected",
        title: "Suscripción pausada",
        body: "Tu suscripción a PadeLibre fue cancelada o pausada en Mercado Pago.",
      });
    }
    log.info({ event: "mp.subscription.cancelled", requestId, clubId, preapprovalId, status });
  }

  return NextResponse.json({ ok: true });
}
