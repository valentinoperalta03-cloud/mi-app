import { NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { verifyMpWebhookSignature } from "@/lib/mp-webhook-signature";
import { createServiceClient } from "@/utils/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

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

async function updateClubSubscription(
  admin: SupabaseClient,
  refs: { clubId: string; preapprovalId: string },
  patch: Record<string, unknown>
) {
  const query = admin.from(DB_TABLES.clubs).update(patch);
  if (refs.clubId) {
    return query.eq("id", refs.clubId).select("owner_id").maybeSingle();
  }
  return query.eq("mp_subscription_id", refs.preapprovalId).select("owner_id").maybeSingle();
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
    if (!preapprovalId) return NextResponse.json({ ok: true });

    if (String(payment.status ?? "").toLowerCase() === "rejected") {
      const { data: updated, error } = await updateClubSubscription(
        admin,
        { clubId: "", preapprovalId },
        { subscription_status: "past_due" }
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
  const refs = { clubId, preapprovalId };

  if (status === "authorized") {
    const { data: updated, error } = await updateClubSubscription(admin, refs, {
      subscription_status: "active",
      next_billing_date: preapproval.next_payment_date ?? null,
      mp_subscription_id: preapprovalId,
    });
    if (error) {
      log.error({ event: "mp.subscription.webhook.update_failed", requestId, err: error });
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    const ownerId = String((updated as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
    if (ownerId) {
      await createNotification(admin, {
        user_id: ownerId,
        type: "payment_approved",
        title: "¡Suscripción activada!",
        body: "Tu suscripción mensual a PadeLibre quedó activa.",
      });
    }
    log.info({ event: "mp.subscription.authorized", requestId, clubId, preapprovalId });
  } else if (status === "cancelled" || status === "paused") {
    const { data: updated, error } = await updateClubSubscription(admin, refs, {
      subscription_status: "paused",
    });
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
