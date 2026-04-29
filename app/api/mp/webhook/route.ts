import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { getPaymentClient } from "@/lib/mercadopago";
import { createNotification } from "@/lib/notifications";

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

async function allParticipantsPaymentsApproved(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  matchId: string
): Promise<boolean> {
  const { data: parts } = await admin
    .from(DB_TABLES.matchParticipants)
    .select("player_id")
    .eq("match_id", matchId);
  if (!parts?.length) return false;
  for (const row of parts) {
    const pid = (row as { player_id: string }).player_id;
    const { data: pay } = await admin
      .from(DB_TABLES.payments)
      .select("status")
      .eq("match_id", matchId)
      .eq("user_id", pid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (String((pay as { status?: string | null } | null)?.status ?? "").toLowerCase() !== "approved") {
      return false;
    }
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
  let body: unknown = null;
  if (req.headers.get("content-type")?.includes("application/json")) {
    body = await req.json().catch(() => null);
  }

  console.log("[mp webhook] called, url:", req.url);
  console.log("[mp webhook] method:", req.method);
  console.log("[mp webhook] body:", JSON.stringify(body));

  const admin = getSupabaseAdmin();
  if (!admin) {
    console.warn("[mp] webhook: sin SUPABASE_SERVICE_ROLE_KEY");
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
    console.error("[mp] webhook get payment", e);
    return NextResponse.json({ ok: true });
  }

  const { matchId, userId: payerUserId } = parseExternalReference(String(mpPayment.external_reference ?? ""));
  if (!matchId) {
    return NextResponse.json({ ok: true });
  }

  const status = String(mpPayment.status ?? "").toLowerCase();
  const now = new Date().toISOString();

  if (status === "approved") {
    let payUpd = admin
      .from(DB_TABLES.payments)
      .update({
        status: "approved",
        mp_payment_id: paymentId,
        updated_at: now,
      })
      .eq("match_id", matchId);
    if (payerUserId) {
      payUpd = payUpd.eq("user_id", payerUserId);
    }
    const { error: payErr } = await payUpd;
    if (payErr) {
      console.error("[mp webhook] update payment approved", payErr);
    }

    if (payerUserId) {
      const allPaid = await allParticipantsPaymentsApproved(admin, matchId);
      if (allPaid) {
        await admin
          .from(DB_TABLES.matches)
          .update({ payment_status: "paid", match_status: "reserved" })
          .eq("id", matchId);
      }
      await createNotification(admin, {
        user_id: payerUserId,
        type: "payment_approved",
        title: "¡Pago confirmado!",
        body: "Tu pago fue procesado correctamente.",
        match_id: matchId,
      });
    } else {
      await admin
        .from(DB_TABLES.matches)
        .update({ payment_status: "paid", match_status: "reserved" })
        .eq("id", matchId);
      const { data: matchRow } = await admin
        .from(DB_TABLES.matches)
        .select("owner_id,total_price")
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
    }
  } else if (status === "rejected" || status === "cancelled" || status === "expired") {
    const paymentDbStatus =
      status === "cancelled" ? "cancelled" : status === "expired" ? "rejected" : "rejected";
    let payUpd = admin
      .from(DB_TABLES.payments)
      .update({
        status: paymentDbStatus,
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
      await admin
        .from(DB_TABLES.matches)
        .update({ payment_status: "refunded", match_status: "cancelled" })
        .eq("id", matchId);
    }
  }

  return NextResponse.json({ ok: true });
}
