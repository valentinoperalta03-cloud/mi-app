import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAlert } from "@/lib/alerts";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { getPaymentClient } from "@/lib/mercadopago";
import { assertMatchPaymentStatusTransition, assertPaymentRowTransition } from "@/lib/state-machines/payment-states";
import { assertMatchTransition } from "@/lib/state-machines/match-states";
import { createNotification } from "@/lib/notifications";
import { parsePracticeRegistrationRef } from "@/lib/mp-practice-preference";
import { parseTournamentRegistrationRef } from "@/lib/mp-tournament-preference";
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
    .select("id, player1_id, tournament_id, payment_status")
    .eq("id", registrationId)
    .maybeSingle();
  const regRow = reg as {
    id?: string;
    player1_id?: string;
    tournament_id?: string;
    payment_status?: string | null;
  } | null;
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
    await admin
      .from(DB_TABLES.tournamentRegistrations)
      .update({
        payment_status: "approved",
        mp_payment_id: params.paymentId,
        amount: Number.isFinite(paidAmount) ? paidAmount : null,
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
        mp_payment_id: params.paymentId,
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

    const { data: srow } = await admin
      .from(DB_TABLES.practiceSessions)
      .select("practice_id, session_date")
      .eq("id", String(regRow.session_id))
      .maybeSingle();
    const { data: prow } = await admin
      .from(DB_TABLES.practices)
      .select("title, club_id")
      .eq("id", String((srow as { practice_id?: string } | null)?.practice_id ?? ""))
      .maybeSingle();
    const p = prow as { title?: string | null; club_id?: string | null } | null;
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

  return true;
}

export async function POST(req: Request) {
  return handleNotification(req);
}

/** Mercado Pago puede enviar GET en algunas configuraciones antiguas. */
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

  const admin = getSupabaseAdmin();
  if (!admin) {
    log.warn({ event: "mp.webhook.no_admin", requestId });
    return NextResponse.json({ ok: true });
  }

  const url = new URL(req.url);
  let { paymentId } = extractPaymentId(req, body);
  if (!paymentId) {
    const qPaymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
    if (qPaymentId) {
      paymentId = qPaymentId;
    }
  }
  if (!paymentId) {
    return NextResponse.json({ ok: true });
  }

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

  if (status === "approved") {
    log.info({
      event: "payment.approved",
      requestId,
      matchId,
      userId: payerUserId ?? undefined,
      mpPaymentId: paymentId,
    });

    if (payerUserId) {
      const { data: rpcRows, error: rpcErr } = await admin.rpc("confirm_participant_payment_atomic", {
        p_match_id: matchId,
        p_user_id: payerUserId,
        p_mp_payment_id: paymentId,
      });
      if (rpcErr) {
        log.error({
          event: "payment.rpc.confirm_failed",
          requestId,
          matchId,
          userId: payerUserId,
          mpPaymentId: paymentId,
          err: rpcErr,
        });
        void sendAlert({
          source: "app",
          kind: "mp_webhook",
          title: "confirm_participant_payment_atomic falló",
          detail: rpcErr.message,
          requestId,
        });
        return NextResponse.json({ ok: true });
      }
      const row = (rpcRows as { payment_row_id?: string; idempotent_ok?: boolean }[] | null)?.[0];
      log.info({
        event: "payment.rpc.confirm_ok",
        requestId,
        matchId,
        paymentId: row?.payment_row_id,
        idempotent: row?.idempotent_ok,
      });

      const { data: group } = await admin
        .from(DB_TABLES.groupChats)
        .select("id")
        .eq("match_id", matchId)
        .maybeSingle();
      const groupId = (group as { id?: string } | null)?.id;
      if (groupId) {
        const { error: memErr } = await admin
          .from(DB_TABLES.groupChatMembers)
          .insert({ group_id: groupId, user_id: payerUserId, role: "member" });
        if (memErr && memErr.code !== "23505") {
          log.error({
            event: "mp.webhook.group_chat_failed",
            requestId,
            matchId,
            userId: payerUserId,
            err: memErr,
          });
        }
      }

      await createNotification(admin, {
        user_id: payerUserId,
        type: "payment_approved",
        title: "¡Pago confirmado!",
        body: "Tu pago fue procesado correctamente.",
        match_id: matchId,
      });
      const { data: ownerRow } = await admin
        .from(DB_TABLES.matches)
        .select("owner_id")
        .eq("id", matchId)
        .maybeSingle();
      const ownerId = String((ownerRow as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
      if (ownerId && ownerId !== payerUserId) {
        await createNotification(admin, {
          user_id: ownerId,
          type: "payment_approved",
          title: "Pago confirmado de jugador",
          body: "Un jugador confirmó su pago y su lugar en el partido.",
          match_id: matchId,
        });
      }
    } else {
      const { data: matchBefore } = await admin
        .from(DB_TABLES.matches)
        .select("match_status,payment_status")
        .eq("id", matchId)
        .maybeSingle();
      const mb = matchBefore as { match_status?: string | null; payment_status?: string | null } | null;
      try {
        assertMatchPaymentStatusTransition(mb?.payment_status, "paid", {
          requestId,
          matchId,
          trigger: "webhook.approved_reserva",
        });
        assertMatchTransition(mb?.match_status, "reserved", {
          requestId,
          matchId,
          trigger: "webhook.approved_reserva",
        });
      } catch {
        /* logging ya en asserts */
      }

      const payUpd = admin
        .from(DB_TABLES.payments)
        .update({
          status: "approved",
          mp_payment_id: paymentId,
          updated_at: now,
        })
        .eq("match_id", matchId);

      const { error: payErr } = await payUpd;
      if (payErr) {
        log.error({ event: "mp.webhook.update_payment_reserva", requestId, matchId, err: payErr });
      }

      await admin
        .from(DB_TABLES.matches)
        .update({ payment_status: "paid", match_status: "reserved" })
        .eq("id", matchId);
      const { data: matchRow } = await admin
        .from(DB_TABLES.matches)
        .select("owner_id,total_price,scheduled_date,court_id,courts(name,club_id)")
        .eq("id", matchId)
        .maybeSingle();
      const ownerId = String((matchRow as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
      if (ownerId) {
        const amount = Number((matchRow as { total_price?: number | null } | null)?.total_price ?? 0);
        await createNotification(admin, {
          user_id: ownerId,
          type: "payment_approved",
          title: "¡Pago confirmado!",
          body: `Tu reserva fue confirmada por $${Number.isFinite(amount) ? Math.round(amount) : 0}.`,
          match_id: matchId,
        });
      }
      const matchTyped = matchRow as {
        total_price?: number | null;
        scheduled_date?: string | null;
        courts?: { name?: string | null; club_id?: string | null } | null;
      } | null;
      const clubId = String(matchTyped?.courts?.club_id ?? "").trim();
      if (clubId) {
        const { data: clubRow } = await admin
          .from(DB_TABLES.clubs)
          .select("owner_id")
          .eq("id", clubId)
          .maybeSingle();
        const clubOwnerId = String((clubRow as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
        if (clubOwnerId) {
          const amount = Number(matchTyped?.total_price ?? 0);
          const courtName = String(matchTyped?.courts?.name ?? "Cancha");
          const date = String(matchTyped?.scheduled_date ?? "");
          await createNotification(admin, {
            user_id: clubOwnerId,
            type: "payment_approved",
            title: "Nueva reserva confirmada",
            body: `Reserva pagada por $${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}. Cancha ${courtName} el ${date}.`,
            match_id: matchId,
          });
        }
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

    if (!payerUserId) {
      const { data: mBefore } = await admin
        .from(DB_TABLES.matches)
        .select("match_status,payment_status")
        .eq("id", matchId)
        .maybeSingle();
      const mb = mBefore as { match_status?: string | null; payment_status?: string | null } | null;
      try {
        assertMatchPaymentStatusTransition(mb?.payment_status, "refunded", {
          requestId,
          matchId,
          trigger: "webhook.refunded_reserva",
        });
        assertMatchTransition(mb?.match_status, "cancelled", {
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
  }

  return NextResponse.json({ ok: true });
}
