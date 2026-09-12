import { NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { translateMpStatusDetail } from "@/lib/mp-status-detail-labels";
import { verifyMpWebhookSignature } from "@/lib/mp-webhook-signature";
import {
  sendSubscriptionPaymentFailedEmail,
  sendSubscriptionPaymentRegularizedEmail,
} from "@/lib/resend-email";
import { createServiceClient } from "@/utils/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const TRIAL_DURATION_MS = 15 * 24 * 60 * 60 * 1000;
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
const NOTIFY_COOLDOWN_MS = 48 * 60 * 60 * 1000;

function formatArs(amount: number | null | undefined): string {
  const value = Number(amount ?? 50000);
  return `$${Math.round(Number.isFinite(value) ? value : 50000).toLocaleString("es-AR")}`;
}

/**
 * Consulta primero Mercado Pago producción.
 * Si el recurso no existe bajo las credenciales productivas, intenta con TEST.
 * Esto permite probar suscripciones TEST sin reemplazar MP_ACCESS_TOKEN.
 */
async function fetchMpSubscriptionResource(path: string): Promise<Response> {
  const productionToken = String(process.env.MP_ACCESS_TOKEN ?? "").trim();
  const testToken = String(process.env.MP_TEST_ACCESS_TOKEN ?? "").trim();

  if (!productionToken) {
    throw new Error("MP_ACCESS_TOKEN no configurado");
  }

  const url = `https://api.mercadopago.com${path}`;

  const productionResponse = await fetch(url, {
    headers: { Authorization: `Bearer ${productionToken}` },
    cache: "no-store",
  });

  if (productionResponse.ok) {
    return productionResponse;
  }

  const canTryTest =
    Boolean(testToken) &&
    [401, 403, 404].includes(productionResponse.status);

  if (!canTryTest) {
    return productionResponse;
  }

  return fetch(url, {
    headers: { Authorization: `Bearer ${testToken}` },
    cache: "no-store",
  });
}


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
    ? await query.eq("id", refs.clubId).select("owner_id, name").maybeSingle()
    : await query.eq("mp_subscription_id", refs.preapprovalId).select("owner_id, name").maybeSingle();

  if (!result.error) {
    logIfClubNotFound(requestId, refs, result.data);
  }
  return result;
}

async function findClubByRefs(admin: SupabaseClient, refs: ClubRefs) {
  const query = admin
    .from(DB_TABLES.clubs)
    .select(
      "id, owner_id, name, subscription_status, next_billing_date, last_webhook_request_id, is_active, deactivation_reason, past_due_since, grace_period_end, last_payment_failure_notified_at"
    );
  return refs.clubId
    ? await query.eq("id", refs.clubId).maybeSingle()
    : await query.eq("mp_subscription_id", refs.preapprovalId).maybeSingle();
}

/**
 * Un club solo se restaura automaticamente (is_active=true) si la baja fue
 * por causa comercial nuestra (trial vencido o grace period de past_due
 * vencido, ambos marcados como deactivation_reason='subscription'). Si el
 * superadmin lo bajo manualmente (deactivation_reason='manual') o por
 * cualquier otro motivo, un pago de MP NO debe revertir esa decision
 * operativa — allow-list explicita, no deny-list del caso manual.
 */
function reactivationPatch(deactivationReason: string | null | undefined): Record<string, unknown> {
  if (deactivationReason !== "subscription") return {};
  return { is_active: true, deactivation_reason: null };
}

type ClubForPaymentEvent = {
  id?: string;
  owner_id?: string | null;
  name?: string | null;
  subscription_status?: string | null;
  deactivation_reason?: string | null;
  past_due_since?: string | null;
  grace_period_end?: string | null;
  last_payment_failure_notified_at?: string | null;
};

/**
 * Primer rechazo del ciclo: arranca past_due_since/grace_period_end y avisa
 * siempre. Rechazo posterior dentro del mismo ciclo: mantiene las mismas
 * fechas de gracia (no se extienden) y solo reavisa si pasaron >= 48hs desde
 * el ultimo aviso, para no saturar al dueño con cada reintento de MP.
 */
async function handleAuthorizedPaymentRejected(
  admin: SupabaseClient,
  params: {
    requestId: string;
    apRefs: ClubRefs;
    club: ClubForPaymentEvent;
    statusDetail: string | null;
    retryAttempt: number;
    amount: number | null;
    mpRequestId: string | null;
  }
): Promise<void> {
  const { requestId, apRefs, club, statusDetail, retryAttempt, amount, mpRequestId } = params;
  const now = new Date();
  const isFirstRejectionOfCycle = club.subscription_status !== "past_due" || !club.past_due_since;

  const graceStart = isFirstRejectionOfCycle ? now : new Date(String(club.past_due_since));
  const graceEnd = isFirstRejectionOfCycle
    ? new Date(now.getTime() + GRACE_PERIOD_MS)
    : new Date(String(club.grace_period_end));

  const shouldNotify =
    isFirstRejectionOfCycle ||
    !club.last_payment_failure_notified_at ||
    now.getTime() - new Date(club.last_payment_failure_notified_at).getTime() >= NOTIFY_COOLDOWN_MS;

  const patch: Record<string, unknown> = {
    subscription_status: "past_due",
    past_due_since: graceStart.toISOString(),
    grace_period_end: graceEnd.toISOString(),
    retry_attempt: retryAttempt,
    last_status_detail: statusDetail,
    last_payment_attempt_at: now.toISOString(),
    ...(mpRequestId ? { last_webhook_request_id: mpRequestId } : {}),
    ...(shouldNotify ? { last_payment_failure_notified_at: now.toISOString() } : {}),
  };

  const { data: updated, error } = await updateClubSubscription(admin, apRefs, patch, requestId);
  if (error) {
    log.error({ event: "mp.subscription.webhook.update_failed", requestId, err: error });
    return;
  }

  log.info({
    event: "mp.subscription.payment_failed",
    requestId,
    preapprovalId: apRefs.preapprovalId,
    isFirstRejectionOfCycle,
    graceEnd: graceEnd.toISOString(),
    notified: shouldNotify,
  });

  if (!shouldNotify) return;

  const updatedRow = updated as { owner_id?: string | null; name?: string | null } | null;
  const ownerId = String(updatedRow?.owner_id ?? club.owner_id ?? "").trim();
  if (!ownerId) return;

  const graceDaysLeft = Math.max(Math.ceil((graceEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)), 0);
  const reasonLabel = translateMpStatusDetail(statusDetail);

  // Best-effort: la notificacion in-app/push y el email nunca deben tirar
  // abajo el webhook — el estado financiero ya quedo persistido arriba.
  try {
    await createNotification(admin, {
      user_id: ownerId,
      type: "payment_rejected",
      title: "Pago de suscripción rechazado",
      body: `${reasonLabel} Tu club sigue activo por ${graceDaysLeft} día${graceDaysLeft === 1 ? "" : "s"} más.`,
    });
  } catch (err) {
    log.error({ event: "mp.subscription.webhook.notify_failed", requestId, err });
  }

  try {
    const { data: authUser } = await admin.auth.admin.getUserById(ownerId);
    const email = authUser?.user?.email;
    if (email) {
      await sendSubscriptionPaymentFailedEmail({
        to: email,
        clubName: String(updatedRow?.name ?? club.name ?? "tu club"),
        amountLabel: formatArs(amount),
        reasonLabel,
        graceDaysLeft,
      });
    }
  } catch (err) {
    log.error({ event: "mp.subscription.webhook.email_failed", requestId, err });
  }
}

/**
 * Cobro aprobado sobre una factura de suscripcion. Reactiva el club, limpia
 * todo rastro de deuda y solo manda el aviso especial de "regularizacion"
 * (email incluido) si el club realmente venia de past_due — un cobro
 * mensual normal no debe generar ese email todos los meses.
 */
async function handleAuthorizedPaymentApproved(
  admin: SupabaseClient,
  params: {
    requestId: string;
    preapprovalId: string;
    club: ClubForPaymentEvent;
    amount: number | null;
    mpRequestId: string | null;
  }
): Promise<void> {
  const { requestId, preapprovalId, club, amount, mpRequestId } = params;

  const preRes = await fetchMpSubscriptionResource(`/preapproval/${preapprovalId}`);
  if (!preRes.ok) {
    log.error({ event: "mp.subscription.webhook.preapproval_fetch_failed", requestId, status: preRes.status });
    return;
  }
  const prePayload = (await preRes.json()) as { next_payment_date?: string };

  const wasInDebt = club.subscription_status === "past_due" || Boolean(club.past_due_since);
  const reactivation = reactivationPatch(club.deactivation_reason);

  const patch: Record<string, unknown> = {
    subscription_status: "active",
    next_billing_date: prePayload.next_payment_date ?? null,
    mp_subscription_id: preapprovalId,
    past_due_since: null,
    grace_period_end: null,
    last_status_detail: null,
    retry_attempt: 0,
    last_payment_failure_notified_at: null,
    last_payment_attempt_at: new Date().toISOString(),
    ...reactivation,
    ...(mpRequestId ? { last_webhook_request_id: mpRequestId } : {}),
  };

  const refs: ClubRefs = { clubId: String(club.id ?? ""), preapprovalId };
  const { data: updated, error } = await updateClubSubscription(admin, refs, patch, requestId);
  if (error) {
    log.error({ event: "mp.subscription.webhook.update_failed", requestId, err: error });
    return;
  }

  log.info({ event: "mp.subscription.payment_approved", requestId, preapprovalId, wasInDebt });

  const updatedRow = updated as { owner_id?: string | null; name?: string | null } | null;
  const ownerId = String(updatedRow?.owner_id ?? club.owner_id ?? "").trim();
  if (!ownerId) return;

  try {
    await createNotification(admin, {
      user_id: ownerId,
      type: "payment_approved",
      title: wasInDebt ? "Pago regularizado" : "Pago aprobado",
      body: wasInDebt
        ? "Tu pago de PadeLibre se procesó correctamente. Tu cuenta quedó al día."
        : "Tu pago mensual de PadeLibre fue procesado correctamente.",
    });
  } catch (err) {
    log.error({ event: "mp.subscription.webhook.notify_failed", requestId, err });
  }

  // El email de "regularizacion" solo aplica si hubo una transicion real
  // desde deuda — evita mandar un email cada mes por el cobro normal.
  if (!wasInDebt) return;

  try {
    const { data: authUser } = await admin.auth.admin.getUserById(ownerId);
    const email = authUser?.user?.email;
    if (email) {
      await sendSubscriptionPaymentRegularizedEmail({
        to: email,
        clubName: String(updatedRow?.name ?? club.name ?? "tu club"),
        amountLabel: formatArs(amount),
        nextBillingLabel: prePayload.next_payment_date
          ? new Date(prePayload.next_payment_date).toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "según tu ciclo de facturación",
      });
    }
  } catch (err) {
    log.error({ event: "mp.subscription.webhook.email_failed", requestId, err });
  }
}

/**
 * Idempotencia real de MP: chequea el x-request-id de la entrega actual
 * contra el ultimo que proceso ese club. A diferencia del chequeo "por
 * estado" (mas abajo), esto detecta reintentos exactos de MP aunque el
 * estado del club ya haya cambiado por otro medio.
 */
async function isDuplicateWebhookDelivery(
  admin: SupabaseClient,
  refs: ClubRefs,
  mpRequestId: string | null
): Promise<boolean> {
  if (!mpRequestId) return false;
  const query = admin.from(DB_TABLES.clubs).select("last_webhook_request_id");
  const { data } = refs.clubId
    ? await query.eq("id", refs.clubId).maybeSingle()
    : await query.eq("mp_subscription_id", refs.preapprovalId).maybeSingle();
  const row = data as { last_webhook_request_id?: string | null } | null;
  return row?.last_webhook_request_id === mpRequestId;
}

export async function handleSubscriptionWebhook(req: Request): Promise<NextResponse> {
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

  // FIX 2: idempotencia por x-request-id de MP (ademas del chequeo por
  // estado que ya habia). MP puede reentregar el mismo evento.
  const mpRequestId = req.headers.get("x-request-id");

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    log.error({ event: "mp.subscription.webhook.no_token", requestId });
    return NextResponse.json({ ok: true });
  }

  const admin = createServiceClient();
  const normalizedTopic = String(topic ?? "").toLowerCase();

  if (normalizedTopic.includes("authorized_payment")) {
    const res = await fetchMpSubscriptionResource(
      `/authorized_payments/${dataId}`
    );
    if (!res.ok) {
      log.error({
        event: "mp.subscription.webhook.authorized_payment_fetch_failed",
        requestId,
        status: res.status,
      });
      return NextResponse.json({ ok: true });
    }
    const invoice = (await res.json()) as {
      id?: string | number;
      status?: string;
      summarized?: string;
      preapproval_id?: string;
      retry_attempt?: number;
      last_modified?: string;
      debit_date?: string;
      transaction_amount?: number;
      currency_id?: string;
      payment?: {
        id?: number | string;
        status?: string;
        status_detail?: string;
      };
    };
    const preapprovalId = String(invoice.preapproval_id ?? "").trim();
    if (!preapprovalId) return NextResponse.json({ ok: true });

    const authorizedPaymentId = String(invoice.id ?? dataId).trim();
    // El estado EFECTIVO es el de payment.status si existe: un
    // authorized_payment puede reportar status="scheduled" a nivel de
    // invoice mientras payment.status ya dice "rejected" (caso real
    // confirmado en produccion — La Catedral del Padel, authorized_payment
    // 7031606874). NUNCA usar invoice.status como fuente si payment.status
    // esta presente.
    const effectiveStatus = String(
      invoice.payment?.status ?? invoice.summarized ?? invoice.status ?? ""
    ).toLowerCase();
    const statusDetail = invoice.payment?.status_detail ?? null;
    const retryAttempt = Number.isFinite(invoice.retry_attempt) ? Number(invoice.retry_attempt) : 0;
    // Fuente de verdad para el orden de eventos: SIEMPRE el last_modified del
    // recurso recien consultado a MP, nunca el payload crudo del webhook ni
    // retry_attempt (que es local a esta factura puntual y no sirve para
    // comparar entre webhooks).
    const mpLastModified = invoice.last_modified ? String(invoice.last_modified) : null;
    const amount = Number.isFinite(invoice.transaction_amount) ? Number(invoice.transaction_amount) : null;

    const apRefs: ClubRefs = { clubId: "", preapprovalId };
    if (await isDuplicateWebhookDelivery(admin, apRefs, mpRequestId)) {
      log.info({ event: "mp.subscription.webhook.duplicate_request_id", requestId, mpRequestId, preapprovalId });
      return NextResponse.json({ received: true, skipped: "duplicate" });
    }

    if (!mpLastModified) {
      // No inventamos now(): sin last_modified no podemos garantizar el
      // orden de eventos para este authorized_payment. Se loguea para
      // investigar por que MP no lo devolvio, pero el estado de clubs se
      // sigue procesando abajo (el GET fresco sigue siendo confiable como
      // snapshot puntual, solo no podemos usarlo para descartar duplicados
      // fuera de orden ni para el historial de subscription_payment_attempts).
      log.warn({
        event: "mp.subscription.webhook.authorized_payment_missing_last_modified",
        requestId,
        authorizedPaymentId,
        preapprovalId,
      });
    } else {
      const { data: lastKnown } = await admin
        .from(DB_TABLES.subscriptionPaymentAttempts)
        .select("mp_last_modified")
        .eq("mp_authorized_payment_id", authorizedPaymentId)
        .order("mp_last_modified", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastKnownModified = (lastKnown as { mp_last_modified?: string } | null)?.mp_last_modified ?? null;
      if (lastKnownModified && new Date(mpLastModified).getTime() <= new Date(lastKnownModified).getTime()) {
        log.info({
          event: "mp.subscription.webhook.stale_authorized_payment",
          requestId,
          authorizedPaymentId,
          mpLastModified,
          lastKnownModified,
        });
        return NextResponse.json({ received: true, skipped: "stale" });
      }
    }

    const { data: clubRow } = await findClubByRefs(admin, apRefs);
    const club = clubRow as ClubForPaymentEvent | null;
    if (!club?.id) {
      logIfClubNotFound(requestId, apRefs, club);
      return NextResponse.json({ ok: true });
    }

    // Auditoria best-effort: si falla el insert del historial, se loguea
    // pero NO debe impedir que se actualice el estado financiero del club
    // (un approved tiene que poder reactivar la suscripcion igual).
    if (mpLastModified) {
      const hasPaymentAttempt = Boolean(invoice.payment?.status);
      const attemptedAtIso = hasPaymentAttempt ? mpLastModified : null;
      const { error: insertError } = await admin.from(DB_TABLES.subscriptionPaymentAttempts).insert({
        club_id: club.id,
        mp_preapproval_id: preapprovalId,
        mp_authorized_payment_id: authorizedPaymentId,
        mp_payment_id: invoice.payment?.id != null ? String(invoice.payment.id) : null,
        status: effectiveStatus,
        status_detail: statusDetail,
        retry_attempt: retryAttempt,
        amount,
        currency: invoice.currency_id ?? "ARS",
        debit_date: invoice.debit_date ?? null,
        mp_last_modified: mpLastModified,
        first_attempted_at: attemptedAtIso,
        last_attempted_at: attemptedAtIso,
        resolved_at: effectiveStatus === "approved" ? mpLastModified : null,
      });
      if (insertError) {
        log.error({
          event: "mp.subscription.webhook.attempt_insert_failed",
          requestId,
          authorizedPaymentId,
          err: insertError,
        });
      }
    }

    if (effectiveStatus === "rejected") {
      await handleAuthorizedPaymentRejected(admin, {
        requestId,
        apRefs,
        club,
        statusDetail,
        retryAttempt,
        amount,
        mpRequestId,
      });
    } else if (effectiveStatus === "approved") {
      await handleAuthorizedPaymentApproved(admin, {
        requestId,
        preapprovalId,
        club,
        amount,
        mpRequestId,
      });
    } else {
      log.info({
        event: "mp.subscription.payment_pending_or_unknown",
        requestId,
        preapprovalId,
        effectiveStatus,
        invoiceStatus: invoice.status ?? null,
        summarized: invoice.summarized ?? null,
      });
    }
    return NextResponse.json({ ok: true });
  }

  const res = await fetchMpSubscriptionResource(
    `/preapproval/${dataId}`
  );
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
    const clubRow = existingClub as {
      id: string;
      owner_id: string | null;
      subscription_status: string | null;
      next_billing_date: string | null;
      last_webhook_request_id: string | null;
      deactivation_reason: string | null;
    };

    if (mpRequestId && clubRow.last_webhook_request_id === mpRequestId) {
      log.info({ event: "mp.subscription.webhook.duplicate_request_id", requestId, mpRequestId, clubId: clubRow.id });
      return NextResponse.json({ received: true, skipped: "duplicate" });
    }

    // FIX 2: idempotencia. MP puede reenviar el mismo evento "authorized" mas
    // de una vez (retries / entregas duplicadas). Sin este chequeo, una
    // segunda entrega llegada despues de que el club ya paso de pending a
    // trial lo saltea directo a active, sin dejar transcurrir el periodo de
    // prueba de 15 dias.
    if (
      clubRow.subscription_status === "active" &&
      clubRow.next_billing_date &&
      new Date(clubRow.next_billing_date) > new Date()
    ) {
      log.info({ event: "mp.subscription.webhook.duplicate_active", requestId, clubId: clubRow.id, preapprovalId });
      return NextResponse.json({ received: true, skipped: "duplicate" });
    }
    if (clubRow.subscription_status === "trial") {
      log.info({ event: "mp.subscription.webhook.duplicate_trial", requestId, clubId: clubRow.id, preapprovalId });
      return NextResponse.json({ received: true, skipped: "already_in_trial" });
    }

    const isPendingActivation = clubRow.subscription_status === "pending";
    const now = new Date();
    const patch = isPendingActivation
      ? {
          subscription_status: "trial",
          trial_start_date: now.toISOString(),
          trial_end_date: new Date(now.getTime() + TRIAL_DURATION_MS).toISOString(),
          mp_subscription_id: preapprovalId,
          ...(mpRequestId ? { last_webhook_request_id: mpRequestId } : {}),
        }
      : {
          subscription_status: "active",
          next_billing_date: preapproval.next_payment_date ?? null,
          mp_subscription_id: preapprovalId,
          ...reactivationPatch(clubRow.deactivation_reason),
          ...(mpRequestId ? { last_webhook_request_id: mpRequestId } : {}),
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
    if (await isDuplicateWebhookDelivery(admin, refs, mpRequestId)) {
      log.info({ event: "mp.subscription.webhook.duplicate_request_id", requestId, mpRequestId, clubId });
      return NextResponse.json({ received: true, skipped: "duplicate" });
    }
    const { data: updated, error } = await updateClubSubscription(
      admin,
      refs,
      { subscription_status: "paused", ...(mpRequestId ? { last_webhook_request_id: mpRequestId } : {}) },
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
