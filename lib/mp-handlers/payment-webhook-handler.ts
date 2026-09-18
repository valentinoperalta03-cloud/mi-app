import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAlert } from "@/lib/alerts";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { getPaymentClient } from "@/lib/mercadopago";
import { verifyMpWebhookSignature } from "@/lib/mp-webhook-signature";
import { assertMatchPaymentStatusTransition, assertPaymentRowTransition } from "@/lib/state-machines/payment-states";
import { assertMatchTransition, canTransitionMatch } from "@/lib/state-machines/match-states";
import { createGroupChat } from "@/lib/group-chats";
import { buildMatchShareUrl } from "@/lib/invite-token";
import { cancelConflictingOpenMatches } from "@/lib/match-conflict";
import { createNotification } from "@/lib/notifications";
import { parsePracticeRegistrationRef } from "@/lib/mp-practice-preference";
import { practiceRegistrationHoldsSpot } from "@/lib/practice-registration";
import { parseTournamentRegistrationRef } from "@/lib/mp-tournament-preference";
import { shouldReleaseHoldOnPaymentNotification } from "@/lib/reservation-hold";
import type { SupabaseClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function extractPaymentId(req: Request, body: unknown): { paymentId: string | null; topic: string | null } {
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic") ?? url.searchParams.get("type");
  const qId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (qId && topic === "payment") {
    return { paymentId: qId, topic };
  }
  if (body && typeof body === "object") {
    const b = body as { type?: string; topic?: string; action?: string; data?: { id?: string } };
    const t = b.type ?? b.topic ?? null;
    const id = b.data?.id != null ? String(b.data.id) : null;
    const action = String(b.action ?? "");
    if (id && (t === "payment" || action.includes("payment"))) {
      return { paymentId: id, topic: t };
    }
  }
  return { paymentId: null, topic: null };
}

function extractMerchantOrderId(req: Request, body: unknown): string | null {
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic") ?? url.searchParams.get("type");
  const qId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (qId && topic === "merchant_order") return qId;
  if (body && typeof body === "object") {
    const b = body as { type?: string; topic?: string; resource?: string; data?: { id?: string } };
    const t = b.type ?? b.topic ?? null;
    if (t === "merchant_order") {
      if (b.data?.id != null) return String(b.data.id);
      const match = String(b.resource ?? "").match(/merchant_orders\/(\d+)/);
      if (match) return match[1];
    }
  }
  return null;
}

function parseExternalReference(ref: string): { matchId: string; userId: string | null } {
  const trimmed = String(ref ?? "").trim();
  if (!trimmed) return { matchId: "", userId: null };
  if (trimmed.includes("__")) {
    const idx = trimmed.indexOf("__");
    const matchId = trimmed.slice(0, idx).trim();
    const userId = trimmed.slice(idx + 2).trim() || null;
    return { matchId, userId };
  }
  return { matchId: trimmed, userId: null };
}

async function handleTournamentPaymentIfPresent(
  admin: SupabaseClient,
  params: {
    requestId: string;
    paymentId: string;
    extRef: string;
    status: string;
    now: string;
    mpPayment: { status?: string; external_reference?: string | null; transaction_amount?: number | null };
  }
): Promise<boolean> {
  const parsed = parseTournamentRegistrationRef(params.extRef);
  if (params.extRef.startsWith("tournament_reg_") && !parsed) {
    log.warn({ event: "mp.webhook.tournament_ref_invalid", requestId: params.requestId, extRef: params.extRef });
    return true;
  }
  if (!parsed) return false;

  const { registrationId, payerUserId } = parsed;
  const { data: reg } = await admin
    .from(DB_TABLES.tournamentRegistrations)
    .select("id, player1_id, tournament_id, payment_status, mp_payment_id, total_price, amount_paid")
    .eq("id", registrationId)
    .maybeSingle();
  const regRow = reg as {
    id?: string;
    player1_id?: string;
    tournament_id?: string;
    payment_status?: string | null;
    mp_payment_id?: string | null;
    total_price?: number | null;
    amount_paid?: number | null;
  } | null;
  // La reserva de cupo por MP vence sola (tournament_register_entry, 20 min).
  // Si el pago llega aprobado después de vencida (o de una baja del club), el
  // cupo puede haber sido reasignado: no reabrir la inscripción ni confirmarla
  // en silencio — se marca para reconciliación manual (ver decisión de
  // producto "cupo + pago online").
  if (params.status === "approved" && regRow?.id && (regRow.payment_status === "expired" || regRow.payment_status === "cancelled")) {
    await admin
      .from(DB_TABLES.tournamentRegistrations)
      .update({ mp_payment_id: params.paymentId, payment_reconciliation_needed: true })
      .eq("id", registrationId);
    log.warn({
      event: "mp.webhook.tournament.approved_after_release",
      requestId: params.requestId,
      registrationId,
      payerUserId,
      previousStatus: regRow.payment_status,
    });
    return true;
  }
  if (!regRow?.id || regRow.player1_id !== payerUserId) {
    log.warn({
      event: "mp.webhook.tournament_registration_mismatch",
      requestId: params.requestId,
      registrationId,
      payerUserId,
    });
    return true;
  }

  const paidAmount = Number(params.mpPayment.transaction_amount ?? 0);

  if (params.status === "approved") {
    if (regRow.payment_status === "approved" && regRow.mp_payment_id === params.paymentId) {
      log.info({
        event: "mp.webhook.tournament.idempotent_skip",
        requestId: params.requestId,
        registrationId,
      });
      return true;
    }

    const totalPrice = Number(regRow.total_price ?? 0);
    const amountPaid = Math.min(
      Number(regRow.amount_paid ?? 0) + (Number.isFinite(paidAmount) ? paidAmount : 0),
      totalPrice > 0 ? totalPrice : Number.MAX_SAFE_INTEGER
    );
    const amountPending = Math.max(totalPrice - amountPaid, 0);
    const financialStatus = amountPaid >= totalPrice && totalPrice > 0 ? "fully_paid" : amountPaid > 0 ? "partially_paid" : "unpaid";

    await admin
      .from(DB_TABLES.tournamentRegistrations)
      .update({
        payment_status: "approved",
        payment_expires_at: null,
        mp_payment_id: params.paymentId,
        amount: Number.isFinite(paidAmount) ? paidAmount : null,
        amount_paid: amountPaid,
        amount_pending: amountPending,
        financial_status: financialStatus,
      })
      .eq("id", registrationId);

    const { data: trow } = await admin
      .from(DB_TABLES.tournaments)
      .select("name, club_id")
      .eq("id", String(regRow.tournament_id))
      .maybeSingle();
    const t = trow as { name?: string | null; club_id?: string | null } | null;
    const { data: crow } = await admin
      .from(DB_TABLES.clubs)
      .select("owner_id, name")
      .eq("id", String(t?.club_id ?? ""))
      .maybeSingle();
    const ownerId = String((crow as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
    if (ownerId) {
      await createNotification(admin, {
        user_id: ownerId,
        type: "tournament_event",
        title: "Inscripción pagada",
        body: `Nueva inscripción pagada en el torneo "${String(t?.name ?? "Torneo").trim()}".`,
      });
    }
    await createNotification(admin, {
      user_id: payerUserId,
      type: "payment_approved",
      title: "¡Pago confirmado!",
      body: "Tu inscripción al torneo fue confirmada.",
    });
    log.info({
      event: "payment.tournament.approved",
      requestId: params.requestId,
      registrationId,
      payerUserId,
      mpPaymentId: params.paymentId,
    });
    return true;
  }

  if (params.status === "rejected" || params.status === "cancelled" || params.status === "expired") {
    await admin
      .from(DB_TABLES.tournamentRegistrations)
      .update({
        payment_status: "cancelled",
        payment_expires_at: null,
        mp_payment_id: params.paymentId,
        amount: null,
      })
      .eq("id", registrationId);
    await createNotification(admin, {
      user_id: payerUserId,
      type: "payment_rejected",
      title: "Pago no procesado",
      body: "No se pudo confirmar el pago de tu inscripción al torneo.",
    });
    return true;
  }

  return true;
}

async function handlePracticePaymentIfPresent(
  admin: SupabaseClient,
  params: {
    requestId: string;
    paymentId: string;
    extRef: string;
    status: string;
    mpPayment: { transaction_amount?: number | null };
  }
): Promise<boolean> {
  const parsed = parsePracticeRegistrationRef(params.extRef);
  if (params.extRef.startsWith("practice_reg_") && !parsed) {
    log.warn({ event: "mp.webhook.practice_ref_invalid", requestId: params.requestId, extRef: params.extRef });
    return true;
  }
  if (!parsed) return false;

  const { registrationId, payerUserId } = parsed;
  const { data: reg } = await admin
    .from(DB_TABLES.practiceRegistrations)
    .select("id, player_id, session_id, payment_status")
    .eq("id", registrationId)
    .maybeSingle();
  const regRow = reg as {
    id?: string;
    player_id?: string;
    session_id?: string;
    payment_status?: string | null;
  } | null;
  if (!regRow?.id || regRow.player_id !== payerUserId) {
    log.warn({
      event: "mp.webhook.practice_registration_mismatch",
      requestId: params.requestId,
      registrationId,
      payerUserId,
    });
    return true;
  }

  const paidAmount = Number(params.mpPayment.transaction_amount ?? 0);

  if (params.status === "approved") {
    const { data: srow } = await admin
      .from(DB_TABLES.practiceSessions)
      .select("practice_id, session_date")
      .eq("id", String(regRow.session_id))
      .maybeSingle();
    const { data: prow } = await admin
      .from(DB_TABLES.practices)
      .select("title, club_id, max_spots")
      .eq("id", String((srow as { practice_id?: string } | null)?.practice_id ?? ""))
      .maybeSingle();
    const p = prow as { title?: string | null; club_id?: string | null; max_spots?: number } | null;
    const maxSpots = Number(p?.max_spots ?? 0);

    const { data: sessionRegs } = await admin
      .from(DB_TABLES.practiceRegistrations)
      .select("id, payment_status")
      .eq("session_id", String(regRow.session_id));
    const occupied = ((sessionRegs ?? []) as Array<{ id: string; payment_status: string }>).filter(
      (r) => r.id !== registrationId && practiceRegistrationHoldsSpot(r.payment_status)
    ).length;

    if (maxSpots > 0 && occupied >= maxSpots) {
      await admin
        .from(DB_TABLES.practiceRegistrations)
        .update({
          payment_status: "cancelled",
          mp_payment_id: params.paymentId,
          amount: Number.isFinite(paidAmount) ? paidAmount : null,
        })
        .eq("id", registrationId);
      await createNotification(admin, {
        user_id: payerUserId,
        type: "payment_rejected",
        title: "Clase completa",
        body: "Tu pago se registró pero la clase ya no tiene cupos. Contactá al club para el reintegro.",
      });
      log.warn({
        event: "payment.practice.approved_but_full",
        requestId: params.requestId,
        registrationId,
        occupied,
        maxSpots,
      });
      return true;
    }

    await admin
      .from(DB_TABLES.practiceRegistrations)
      .update({
        payment_status: "approved",
        payment_method: "mercadopago",
        mp_payment_id: params.paymentId,
        amount: Number.isFinite(paidAmount) ? paidAmount : null,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", registrationId);
    const { data: crow } = await admin
      .from(DB_TABLES.clubs)
      .select("owner_id, name")
      .eq("id", String(p?.club_id ?? ""))
      .maybeSingle();
    const ownerId = String((crow as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
    const sessionDate = String((srow as { session_date?: string } | null)?.session_date ?? "").trim();
    if (ownerId) {
      await createNotification(admin, {
        user_id: ownerId,
        type: "practice_event",
        title: "Inscripción pagada",
        body: `Nueva inscripción pagada en la clase "${String(p?.title ?? "Clase").trim()}"${sessionDate ? ` (${sessionDate})` : ""}.`,
      });
    }
    await createNotification(admin, {
      user_id: payerUserId,
      type: "payment_approved",
      title: "¡Pago confirmado!",
      body: "Tu inscripción a la clase fue confirmada.",
    });
    log.info({
      event: "payment.practice.approved",
      requestId: params.requestId,
      registrationId,
      payerUserId,
      mpPaymentId: params.paymentId,
    });
    return true;
  }

  if (params.status === "rejected" || params.status === "cancelled" || params.status === "expired") {
    await admin
      .from(DB_TABLES.practiceRegistrations)
      .update({
        payment_status: "cancelled",
        mp_payment_id: params.paymentId,
      })
      .eq("id", registrationId);
    await createNotification(admin, {
      user_id: payerUserId,
      type: "payment_rejected",
      title: "Pago no procesado",
      body: "No se pudo confirmar el pago de tu inscripción a la clase.",
    });
    return true;
  }

  // Statuses intermedios (in_process, authorized, etc.): MP enviará la notificación final.
  // Actualizar mp_payment_id para trazabilidad y esperar la notificación definitiva.
  if (params.paymentId) {
    await admin
      .from(DB_TABLES.practiceRegistrations)
      .update({ mp_payment_id: params.paymentId })
      .eq("id", registrationId);
  }
  return true;
}

/**
 * Notifica al jugador y al club, y desaloja partidos abiertos en conflicto,
 * recién cuando una reserva de cancha REALMENTE se confirma (hold convertido
 * a match). Antes esto corría en reservarCancha() al crear el hold — bajo la
 * regla de producto vigente eso pasó a ser prematuro: en ese momento todavía
 * no hay ninguna reserva real.
 */
async function notifyReservationConfirmed(admin: SupabaseClient, matchId: string, requestId: string): Promise<void> {
  const { data: matchRow } = await admin
    .from(DB_TABLES.matches)
    .select(
      "owner_id,total_price,amount_paid,amount_pending,financial_status,scheduled_date,scheduled_time,court_id,courts(name,club_id)"
    )
    .eq("id", matchId)
    .maybeSingle();
  const m = matchRow as {
    owner_id?: string | null;
    total_price?: number | null;
    amount_paid?: number | null;
    amount_pending?: number | null;
    financial_status?: string | null;
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    court_id?: string | null;
    courts?: { name?: string | null; club_id?: string | null } | null;
  } | null;
  if (!m) {
    log.error({ event: "mp.webhook.hold.notify_missing_match", requestId, matchId });
    return;
  }

  const amountPaid = Number(m.amount_paid ?? 0);
  const amountPending = Number(m.amount_pending ?? 0);

  if (m.owner_id) {
    const body =
      m.financial_status === "fully_paid"
        ? `Tu reserva fue confirmada por $${Math.round(amountPaid)}.`
        : `Tu seña de $${Math.round(amountPaid)} fue confirmada. Tu turno quedó reservado. Resta $${Math.round(amountPending)}.`;
    await createNotification(admin, {
      user_id: m.owner_id,
      type: "payment_approved",
      title: "¡Pago confirmado!",
      body,
      match_id: matchId,
    });
  }

  const clubId = String(m.courts?.club_id ?? "").trim();
  if (clubId) {
    const { data: clubRow } = await admin.from(DB_TABLES.clubs).select("owner_id").eq("id", clubId).maybeSingle();
    const clubOwnerId = String((clubRow as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
    if (clubOwnerId) {
      const courtNameLbl = String(m.courts?.name ?? "Cancha");
      const dateLbl = String(m.scheduled_date ?? "");
      const body =
        m.financial_status === "fully_paid"
          ? `Reserva pagada por $${amountPaid.toFixed(2)}. Cancha ${courtNameLbl} el ${dateLbl}.`
          : `Reserva confirmada con seña de $${amountPaid.toFixed(2)} (resta $${amountPending.toFixed(2)}). Cancha ${courtNameLbl} el ${dateLbl}.`;
      await createNotification(admin, {
        user_id: clubOwnerId,
        type: "payment_approved",
        title: "Nueva reserva confirmada",
        body,
        match_id: matchId,
      });
    }
  }

  if (m.court_id && m.scheduled_date && m.scheduled_time) {
    await cancelConflictingOpenMatches(admin, m.court_id, m.scheduled_date, String(m.scheduled_time).slice(0, 5));
  }
}

/**
 * Si `extRef` apunta a un `reservation_holds.id` (flujo vigente: una reserva
 * de cancha solo existe en `matches` una vez pagada), maneja el pago acá y
 * devuelve `true` para que el caller no siga con el camino legacy de matches
 * directo. Si `extRef` no matchea ningún hold, devuelve `false` — puede ser
 * un checkout legacy iniciado con el código anterior al deploy de
 * reservation_holds (ver 20260917120000_reservation_holds.sql), que el
 * caller sigue sabiendo procesar sobre matches directamente.
 */
async function handleReservationHoldPaymentIfPresent(
  admin: SupabaseClient,
  params: {
    requestId: string;
    paymentId: string;
    holdId: string;
    payerUserId: string | null;
    status: string;
    mpPayment: { transaction_amount?: number | null };
  }
): Promise<boolean> {
  const { data: holdRow } = await admin
    .from(DB_TABLES.reservationHolds)
    .select("id,owner_id,status,scheduled_date,scheduled_time,court_id,location_name")
    .eq("id", params.holdId)
    .maybeSingle();
  const hold = holdRow as {
    id?: string;
    owner_id?: string | null;
    status?: string | null;
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    court_id?: string | null;
    location_name?: string | null;
  } | null;
  if (!hold?.id) return false;

  if (params.status === "approved") {
    const transactionAmount = Number(params.mpPayment.transaction_amount ?? 0);
    const { data: rpcRows, error: rpcError } = await admin.rpc("consume_reservation_hold", {
      p_hold_id: hold.id,
      p_mp_payment_id: params.paymentId,
      p_transaction_amount: Number.isFinite(transactionAmount) ? transactionAmount : 0,
    });

    if (rpcError) {
      log.error({
        event: "mp.webhook.hold.consume_rpc_failed",
        requestId: params.requestId,
        holdId: hold.id,
        paymentId: params.paymentId,
        err: rpcError,
      });
      void sendAlert({
        source: "app",
        kind: "mp_webhook",
        title: "Falló consume_reservation_hold",
        detail: `Hold ${hold.id}, pago ${params.paymentId}: ${rpcError.message}. Requiere revisión manual.`,
        requestId: params.requestId,
      });
      return true;
    }

    const result = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as
      | { ok?: boolean; reason?: string | null; match_id?: string | null }
      | null;

    if (result?.ok && result.match_id) {
      log.info({
        event: "payment.hold_converted",
        requestId: params.requestId,
        holdId: hold.id,
        matchId: result.match_id,
        mpPaymentId: params.paymentId,
        idempotent: result.reason === "already_consumed",
      });
      // already_consumed: retry/doble webhook del mismo pago — el match y las
      // notificaciones ya se dispararon la primera vez, no repetir.
      if (result.reason !== "already_consumed") {
        await notifyReservationConfirmed(admin, result.match_id, params.requestId);
      }
      return true;
    }

    // reason === 'hold_lost' (vencido/cancelado/ya consumido por otro flujo)
    // o 'hold_not_found'. El dinero SÍ se recibió, pero no existe ninguna
    // fila en `payments` para este hold (esa fila recién se crea dentro de
    // la conversión exitosa, y payments.match_id es NOT NULL — no hay match
    // al que atarla). Nunca se recupera la cancha en silencio ni se crea una
    // reserva. El dinero SÍ queda persistido, auditable, en
    // orphaned_reservation_payments — nunca solo en logs.
    const orphanAmount = Number.isFinite(transactionAmount) ? transactionAmount : 0;
    const { error: orphanInsertErr } = await admin.from(DB_TABLES.orphanedReservationPayments).insert({
      mp_payment_id: params.paymentId,
      hold_id: hold.id,
      owner_id: hold.owner_id ?? null,
      amount: orphanAmount,
      reason: "approved_after_hold_lost",
      status: "approved",
      metadata: {
        rpc_reason: result?.reason ?? "unknown",
        scheduled_date: hold.scheduled_date,
        scheduled_time: hold.scheduled_time,
        court_id: hold.court_id,
        location_name: hold.location_name,
        requestId: params.requestId,
      },
    });
    // Idempotencia real: UNIQUE(mp_payment_id) en la tabla, no un chequeo de
    // aplicación. Un webhook duplicado para el mismo pago choca acá (23505)
    // y no es un error — el dinero ya está registrado desde la primera vez.
    const alreadyRecorded = orphanInsertErr?.code === "23505";
    if (orphanInsertErr && !alreadyRecorded) {
      log.error({
        event: "mp.webhook.hold.orphaned_payment_insert_failed",
        requestId: params.requestId,
        holdId: hold.id,
        paymentId: params.paymentId,
        err: orphanInsertErr,
      });
    }

    log.error({
      event: "mp.webhook.hold.approved_after_lost",
      requestId: params.requestId,
      holdId: hold.id,
      paymentId: params.paymentId,
      reason: result?.reason ?? "unknown",
      persisted: !orphanInsertErr || alreadyRecorded,
    });
    if (!alreadyRecorded) {
      void sendAlert({
        source: "app",
        kind: "mp_webhook",
        title: "Pago aprobado sobre un hold perdido",
        detail: `Hold ${hold.id} ya no estaba disponible (${result?.reason ?? "desconocido"}) cuando llegó el pago aprobado ${params.paymentId} por $${orphanAmount}. No se creó ninguna reserva. Dinero registrado en orphaned_reservation_payments para revisión/reintegro manual.`,
        requestId: params.requestId,
      });
    }
    return true;
  }

  if (params.status === "rejected" || params.status === "cancelled" || params.status === "expired") {
    // NO cancelar el hold acá — ver shouldReleaseHoldOnPaymentNotification en
    // lib/reservation-hold.ts. Un status rejected/cancelled/expired de UN
    // intento de pago no es terminal para la preferencia completa: Checkout
    // Pro permite reintentar con otro medio sin abandonar el checkout, y ese
    // segundo intento puede llegar aprobado segundos después sobre el MISMO
    // hold. Cancelar acá liberaba la cancha (y desbloqueaba un segundo hold
    // del mismo usuario vía findActivePendingHold) mientras ese dinero podía
    // seguir en vuelo. El hold solo se libera por consumo real (pago
    // aprobado) o por vencimiento natural de expires_at.
    if (shouldReleaseHoldOnPaymentNotification(params.status)) {
      await admin
        .from(DB_TABLES.reservationHolds)
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", hold.id)
        .eq("status", "pending");
    }
    if (params.payerUserId) {
      await createNotification(admin, {
        user_id: params.payerUserId,
        type: "payment_rejected",
        title: "Pago rechazado",
        body: "No se pudo procesar tu pago. Intentá con otro medio.",
      });
    }
    return true;
  }

  // in_process / authorized / pending: estado intermedio, MP mandará la
  // notificación final — nada que tocar en el hold todavía.
  return true;
}

/**
 * Procesa un pago de MP ya identificado (ya sea porque el webhook trajo el
 * paymentId directamente, o porque se extrajo de un merchant_order). No
 * verifica firma: eso ya lo hizo el caller sobre el dataId de la notificacion
 * original.
 */
async function processPaymentId(
  admin: SupabaseClient,
  paymentId: string,
  requestId: string
): Promise<NextResponse> {
  let mpPayment: { status?: string; external_reference?: string | null };
  try {
    mpPayment = await getPaymentClient().get({ id: paymentId });
  } catch (e) {
    log.error({ event: "mp.webhook.get_payment_failed", requestId, mpPaymentId: paymentId, err: e });
    void sendAlert({
      source: "app",
      kind: "mp_webhook",
      title: "MP webhook: fallo al obtener pago",
      detail: String(e instanceof Error ? e.message : e).slice(0, 500),
      requestId,
    });
    return NextResponse.json({ ok: true });
  }

  const extRef = String(mpPayment.external_reference ?? "").trim();
  const status = String(mpPayment.status ?? "").toLowerCase();
  const now = new Date().toISOString();

  const practiceHandled = await handlePracticePaymentIfPresent(admin, {
    requestId,
    paymentId,
    extRef,
    status,
    mpPayment: mpPayment as { transaction_amount?: number | null },
  });
  if (practiceHandled) {
    return NextResponse.json({ ok: true });
  }

  const tournamentHandled = await handleTournamentPaymentIfPresent(admin, {
    requestId,
    paymentId,
    extRef,
    status,
    now,
    mpPayment,
  });
  if (tournamentHandled) {
    return NextResponse.json({ ok: true });
  }

  const { matchId, userId: payerUserId } = parseExternalReference(extRef);
  if (!matchId) {
    return NextResponse.json({ ok: true });
  }

  const holdHandled = await handleReservationHoldPaymentIfPresent(admin, {
    requestId,
    paymentId,
    holdId: matchId,
    payerUserId,
    status,
    mpPayment: mpPayment as { transaction_amount?: number | null },
  });
  if (holdHandled) {
    return NextResponse.json({ ok: true });
  }

  // A partir de acá, camino legacy: extRef apuntaba directo a un `matches.id`
  // (checkout iniciado con el código anterior a reservation_holds, todavía
  // en vuelo al momento del deploy). Sigue funcionando sin cambios.
  if (status === "approved") {
    log.info({
      event: "payment.approved",
      requestId,
      matchId,
      userId: payerUserId ?? undefined,
      mpPaymentId: paymentId,
    });

    const { data: existingPayment } = await admin
      .from(DB_TABLES.payments)
      .select("id,status,mp_payment_id")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const existingPay = existingPayment as { id?: string; status?: string | null; mp_payment_id?: string | null } | null;
    if (existingPay?.status === "approved" && existingPay.mp_payment_id === paymentId) {
      log.info({ event: "mp.webhook.match.idempotent_skip", requestId, matchId, paymentId });
      return NextResponse.json({ ok: true });
    }

    const { data: matchBefore } = await admin
      .from(DB_TABLES.matches)
      .select(
        "owner_id,match_status,payment_status,total_price,amount_paid,scheduled_date,court_id,courts(name,club_id),match_type,gender_category,visibility,location_name,invited_friend_ids,confirmed_at"
      )
      .eq("id", matchId)
      .maybeSingle();
    const mb = matchBefore as {
      owner_id?: string | null;
      confirmed_at?: string | null;
      match_status?: string | null;
      payment_status?: string | null;
      total_price?: number | null;
      amount_paid?: number | null;
      scheduled_date?: string | null;
      courts?: { name?: string | null; club_id?: string | null } | null;
      match_type?: string | null;
      gender_category?: string | null;
      visibility?: string | null;
      location_name?: string | null;
      invited_friend_ids?: string[] | null;
    } | null;

    // El hold puede haber vencido (o haber sido cancelado por el usuario)
    // ANTES de que llegue este webhook: otro jugador puede ya haber tomado
    // ese horario. No hay transición legal de 'cancelled' a 'reserved'
    // (ver lib/state-machines/match-states.ts), así que no hay que re-ocupar
    // la cancha en silencio. El dinero sí se recibió: se deja registrado y
    // alertado para revisión/reintegro manual, sin inventar un refund automático.
    if (!canTransitionMatch(mb?.match_status, "reserved")) {
      log.error({
        event: "mp.webhook.approved_after_hold_lost",
        requestId,
        matchId,
        paymentId,
        matchStatusAtWebhook: mb?.match_status ?? null,
      });
      void sendAlert({
        source: "app",
        kind: "mp_webhook",
        title: "Pago aprobado sobre un hold ya vencido/cancelado",
        detail: `Match ${matchId} estaba en estado "${mb?.match_status ?? "desconocido"}" cuando llegó el pago aprobado ${paymentId}. No se re-confirmó la reserva (el horario puede estar ocupado por otro usuario). Requiere revisión manual: posible reintegro.`,
        requestId,
      });
      await admin
        .from(DB_TABLES.payments)
        .update({ status: "approved", mp_payment_id: paymentId, updated_at: now })
        .eq("match_id", matchId);
      return NextResponse.json({ ok: true });
    }

    const totalPrice = Number(mb?.total_price ?? 0);
    const transactionAmount = Number(
      (mpPayment as { transaction_amount?: number | null }).transaction_amount ?? 0
    );
    const amountPaid = Math.min(
      Number(mb?.amount_paid ?? 0) + (Number.isFinite(transactionAmount) ? transactionAmount : 0),
      totalPrice > 0 ? totalPrice : Number.MAX_SAFE_INTEGER
    );
    const amountPending = Math.max(totalPrice - amountPaid, 0);
    const financialStatus = amountPaid >= totalPrice && totalPrice > 0 ? "fully_paid" : amountPaid > 0 ? "partially_paid" : "unpaid";

    try {
      assertMatchPaymentStatusTransition(mb?.payment_status, "paid", {
        requestId,
        matchId,
        trigger: "webhook.approved_match",
      });
      assertMatchTransition(mb?.match_status, "reserved", {
        requestId,
        matchId,
        trigger: "webhook.approved_match",
      });
    } catch {
      /* logging ya en asserts */
    }

    const { error: payErr } = await admin
      .from(DB_TABLES.payments)
      .update({
        status: "approved",
        mp_payment_id: paymentId,
        updated_at: now,
      })
      .eq("match_id", matchId);
    if (payErr) {
      log.error({ event: "mp.webhook.update_payment_reserva", requestId, matchId, err: payErr });
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    await admin
      .from(DB_TABLES.matches)
      .update({
        payment_status: "paid",
        match_status: "reserved",
        amount_paid: amountPaid,
        amount_pending: amountPending,
        financial_status: financialStatus,
        // La seña aprobada es el evento que confirma la reserva: desde acá corre
        // la política de cancelación del club. No se pisa si ya estaba seteado.
        confirmed_at: mb?.confirmed_at ?? now,
      })
      .eq("id", matchId);

    const ownerId = String(mb?.owner_id ?? "").trim();

    // El partido recién se confirma acá (no en crearPartido) cuando la seña se
    // paga por Mercado Pago: crear el chat grupal y notificar a los amigos
    // invitados en este momento, no antes. Las reservas de cancha (sin
    // partido/amigos) no llevan chat grupal.
    if (ownerId && String(mb?.match_type ?? "").toLowerCase() !== "reservation") {
      const { data: existingChat } = await admin
        .from(DB_TABLES.groupChats)
        .select("id")
        .eq("match_id", matchId)
        .maybeSingle();
      if (!existingChat) {
        const clubName = String(mb?.location_name ?? "Club").trim() || "Club";
        const friendlyDate = String(mb?.scheduled_date ?? "").split("-").reverse().join("/");
        const competitiveLabel =
          String(mb?.match_type ?? "").toLowerCase() === "competitivo" ? "Partido competitivo" : "Partido amistoso";
        const genderCategory = String(mb?.gender_category ?? "mixto").toLowerCase();
        const genderLabel =
          genderCategory === "femenino"
            ? "Partido femenino"
            : genderCategory === "mixto"
              ? "Partido mixto"
              : "Partido masculino";
        const groupRes = await createGroupChat(
          admin,
          ownerId,
          `Partido en ${clubName} el ${friendlyDate}`,
          `• ${competitiveLabel}\n• ${genderLabel}`,
          [],
          matchId
        );
        if (!groupRes.ok) {
          log.error({ event: "mp.webhook.group_chat_failed", requestId, matchId, err: groupRes.message });
        }

        const invitedFriendIds = (mb?.invited_friend_ids ?? []).filter(Boolean);
        if (invitedFriendIds.length > 0) {
          const shareUrl = buildMatchShareUrl(matchId, mb?.visibility);
          await Promise.all(
            invitedFriendIds.map((friendId) =>
              createNotification(admin, {
                user_id: friendId,
                type: "join_request",
                title: "¡Te invitaron a un partido!",
                body: `Te invitaron a un partido. Confirmá tu lugar desde acá: ${shareUrl}`,
                match_id: matchId,
              })
            )
          );
        }
      }
    }

    if (ownerId) {
      const body =
        financialStatus === "fully_paid"
          ? `Tu reserva fue confirmada por $${Math.round(amountPaid)}.`
          : `Tu seña de $${Math.round(amountPaid)} fue confirmada. Tu turno quedó reservado. Resta $${Math.round(amountPending)}.`;
      await createNotification(admin, {
        user_id: ownerId,
        type: "payment_approved",
        title: "¡Pago confirmado!",
        body,
        match_id: matchId,
      });
    }
    const clubId = String(mb?.courts?.club_id ?? "").trim();
    if (clubId) {
      const { data: clubRow } = await admin
        .from(DB_TABLES.clubs)
        .select("owner_id")
        .eq("id", clubId)
        .maybeSingle();
      const clubOwnerId = String((clubRow as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
      if (clubOwnerId) {
        const courtName = String(mb?.courts?.name ?? "Cancha");
        const date = String(mb?.scheduled_date ?? "");
        const body =
          financialStatus === "fully_paid"
            ? `Reserva pagada por $${amountPaid.toFixed(2)}. Cancha ${courtName} el ${date}.`
            : `Reserva confirmada con seña de $${amountPaid.toFixed(2)} (resta $${amountPending.toFixed(2)}). Cancha ${courtName} el ${date}.`;
        await createNotification(admin, {
          user_id: clubOwnerId,
          type: "payment_approved",
          title: "Nueva reserva confirmada",
          body,
          match_id: matchId,
        });
      }
    }
  } else if (status === "rejected" || status === "cancelled" || status === "expired") {
    const { data: payRow } = payerUserId
      ? await admin
          .from(DB_TABLES.payments)
          .select("id,status")
          .eq("match_id", matchId)
          .eq("user_id", payerUserId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    const prevPay = (payRow as { status?: string | null } | null)?.status;
    const dbPayStatus =
      status === "cancelled" ? "cancelled" : status === "expired" ? "expired" : "rejected";
    try {
      if (payerUserId) {
        assertPaymentRowTransition(prevPay, dbPayStatus, {
          requestId,
          paymentId: (payRow as { id?: string } | null)?.id,
          userId: payerUserId,
          trigger: "webhook.rejected",
        });
      }
    } catch {
      /* logged */
    }

    let payUpd = admin
      .from(DB_TABLES.payments)
      .update({
        status: dbPayStatus,
        mp_payment_id: paymentId,
        updated_at: now,
      })
      .eq("match_id", matchId);
    if (payerUserId) {
      payUpd = payUpd.eq("user_id", payerUserId);
    }
    await payUpd;

    if (payerUserId) {
      await admin
        .from(DB_TABLES.matches)
        .update({ match_status: "cancelled", payment_status: dbPayStatus })
        .eq("id", matchId);
      await createNotification(admin, {
        user_id: payerUserId,
        type: "payment_rejected",
        title: "Pago rechazado",
        body: "No se pudo procesar tu pago. Intentá con otro medio.",
        match_id: matchId,
      });
    } else {
      const { data: mBefore } = await admin
        .from(DB_TABLES.matches)
        .select("match_status,payment_status")
        .eq("id", matchId)
        .maybeSingle();
      const mb = mBefore as { match_status?: string | null; payment_status?: string | null } | null;
      try {
        assertMatchPaymentStatusTransition(mb?.payment_status, status === "cancelled" ? "cancelled" : "rejected", {
          requestId,
          matchId,
          trigger: "webhook.reject_reserva",
        });
        assertMatchTransition(mb?.match_status, "cancelled", {
          requestId,
          matchId,
          trigger: "webhook.reject_reserva",
        });
      } catch {
        /* logged */
      }

      await admin
        .from(DB_TABLES.matches)
        .update({
          payment_status: status === "cancelled" ? "cancelled" : "rejected",
          match_status: "cancelled",
        })
        .eq("id", matchId);
      const { data: ownerRow } = await admin
        .from(DB_TABLES.matches)
        .select("owner_id")
        .eq("id", matchId)
        .maybeSingle();
      const ownerId = String((ownerRow as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
      if (ownerId) {
        await createNotification(admin, {
          user_id: ownerId,
          type: "payment_rejected",
          title: "Pago rechazado",
          body: "No se pudo procesar el pago de tu reserva.",
          match_id: matchId,
        });
      }
    }
  } else if (status === "refunded" || status === "charged_back") {
    // FIX 4: ademas de payment_status/match_status, sincronizar los campos
    // financieros del match — antes quedaban con la plata "cobrada" pese al
    // reembolso real en MP.
    const { data: matchForRefund } = await admin
      .from(DB_TABLES.matches)
      .select("match_status,payment_status,total_price")
      .eq("id", matchId)
      .maybeSingle();
    const matchRow = matchForRefund as {
      match_status?: string | null;
      payment_status?: string | null;
      total_price?: number | null;
    } | null;

    let payUpd = admin
      .from(DB_TABLES.payments)
      .update({
        status: "refunded",
        mp_payment_id: paymentId,
        updated_at: now,
      })
      .eq("match_id", matchId);
    if (payerUserId) {
      payUpd = payUpd.eq("user_id", payerUserId);
    }
    await payUpd;

    if (payerUserId) {
      await admin
        .from(DB_TABLES.matches)
        .update({ match_status: "cancelled", payment_status: "refunded" })
        .eq("id", matchId);
    } else {
      try {
        assertMatchPaymentStatusTransition(matchRow?.payment_status, "refunded", {
          requestId,
          matchId,
          trigger: "webhook.refunded_reserva",
        });
        assertMatchTransition(matchRow?.match_status, "cancelled", {
          requestId,
          matchId,
          trigger: "webhook.refunded_reserva",
        });
      } catch {
        /* logged */
      }

      await admin
        .from(DB_TABLES.matches)
        .update({ payment_status: "refunded", match_status: "cancelled" })
        .eq("id", matchId);
    }

    await admin
      .from(DB_TABLES.matches)
      .update({
        financial_status: "unpaid",
        amount_paid: 0,
        amount_pending: Number(matchRow?.total_price ?? 0),
      })
      .eq("id", matchId);
  } else if (status === "in_process" || status === "authorized" || status === "pending") {
    // FIX 5: estados intermedios — MP todavia va a mandar la notificacion final.
    console.log(`[webhook] pago ${paymentId} en estado intermedio: ${status} — esperando notificación final`);
    return NextResponse.json({ received: true, status: "waiting_final" });
  }

  return NextResponse.json({ ok: true });
}

/**
 * FIX 3: un merchant_order trae un `resource`/id de orden, no un payment id.
 * Se consulta la orden en la API de MP y se procesa cada pago aprobado con
 * la misma logica que un topic=payment normal.
 */
async function handleMerchantOrderWebhook(
  admin: SupabaseClient,
  requestId: string,
  merchantOrderId: string
): Promise<NextResponse> {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    log.warn({ event: "mp.webhook.merchant_order.no_token", requestId, merchantOrderId });
    return NextResponse.json({ ok: true });
  }

  let order: { payments?: Array<{ id?: string | number; status?: string }> };
  try {
    const res = await fetch(`https://api.mercadopago.com/merchant_orders/${merchantOrderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      log.warn({
        event: "mp.webhook.merchant_order.fetch_failed",
        requestId,
        merchantOrderId,
        status: res.status,
      });
      return NextResponse.json({ ok: true });
    }
    order = await res.json();
  } catch (err) {
    log.warn({ event: "mp.webhook.merchant_order.fetch_error", requestId, merchantOrderId, err });
    return NextResponse.json({ ok: true });
  }

  const approvedPaymentIds = (order.payments ?? [])
    .filter((p) => String(p.status ?? "").toLowerCase() === "approved" && p.id != null)
    .map((p) => String(p.id));

  log.info({
    event: "mp.webhook.merchant_order.received",
    requestId,
    merchantOrderId,
    approvedCount: approvedPaymentIds.length,
  });

  for (const paymentId of approvedPaymentIds) {
    await processPaymentId(admin, paymentId, requestId);
  }
  return NextResponse.json({ ok: true });
}

export async function handlePaymentWebhook(req: Request): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  let body: unknown = null;
  if (req.headers.get("content-type")?.includes("application/json")) {
    body = await req.json().catch((err) => {
      log.warn({ event: "mp.webhook.body_parse_failed", requestId, err });
      return null;
    });
  }

  const bodySummary =
    body && typeof body === "object"
      ? {
          type: (body as { type?: string }).type,
          topic: (body as { topic?: string }).topic,
          action: (body as { action?: string }).action,
          dataId: (body as { data?: { id?: string } }).data?.id,
        }
      : null;
  log.info({
    event: "mp.webhook.received",
    requestId,
    method: req.method,
    bodySummary,
  });

  const url = new URL(req.url);
  let { paymentId } = extractPaymentId(req, body);
  if (!paymentId) {
    const qPaymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
    if (qPaymentId) {
      paymentId = qPaymentId;
    }
  }

  if (!paymentId) {
    // FIX 3: antes de descartar en silencio, intentar tratarlo como
    // merchant_order (el otro tipo de notificacion que enruta el endpoint
    // unificado hacia este handler).
    const merchantOrderId = extractMerchantOrderId(req, body);
    if (!merchantOrderId) {
      log.info({ event: "mp.webhook.unhandled_notification", requestId, bodySummary });
      return NextResponse.json({ ok: true });
    }

    const signatureVerified = await verifyMpWebhookSignature(req, merchantOrderId);
    if (!signatureVerified) {
      log.warn({ event: "mp.webhook.invalid_signature", requestId, merchantOrderId });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      log.warn({ event: "mp.webhook.no_admin", requestId });
      return NextResponse.json({ ok: true });
    }
    return handleMerchantOrderWebhook(admin, requestId, merchantOrderId);
  }

  // FIX 1: verificar firma HMAC antes de tocar la DB o llamar a la API de MP.
  // Mismo comportamiento fail-open que el webhook de suscripciones: si
  // MP_WEBHOOK_SECRET no esta configurada, verifyMpWebhookSignature deja
  // pasar con un warning (ver lib/mp-webhook-signature.ts).
  const signatureVerified = await verifyMpWebhookSignature(req, paymentId);
  if (!signatureVerified) {
    log.warn({ event: "mp.webhook.invalid_signature", requestId, paymentId });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    log.warn({ event: "mp.webhook.no_admin", requestId });
    return NextResponse.json({ ok: true });
  }

  return processPaymentId(admin, paymentId, requestId);
}
