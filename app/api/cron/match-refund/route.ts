import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { getPaymentRefundClient } from "@/lib/mercadopago";
import { createNotification } from "@/lib/notifications";

type MatchRow = {
  id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  payment_status: string | null;
  match_status: string | null;
};

type PaymentRow = {
  id: string;
  user_id: string;
  mp_payment_id: string | null;
  status: string | null;
};

function parseMatchDateTime(date: string | null, time: string | null): Date | null {
  const datePart = String(date ?? "").trim();
  if (!datePart) return null;
  const timePart = String(time ?? "").trim().slice(0, 5) || "00:00";
  const parsed = new Date(`${datePart}T${timePart}:00`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const today = now.toISOString().split("T")[0];

  const { data: matches } = await supabase
    .from(DB_TABLES.matches)
    .select("id, scheduled_date, scheduled_time, payment_status, match_status")
    .eq("payment_status", "paid")
    .neq("match_status", "cancelled")
    .lte("scheduled_date", today);

  if (!matches?.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;
  for (const match of (matches ?? []) as MatchRow[]) {
    const matchStart = parseMatchDateTime(match.scheduled_date, match.scheduled_time);
    if (!matchStart || matchStart > tenMinAgo) continue;

    const { count } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id", { count: "exact", head: true })
      .eq("match_id", match.id);

    if ((count ?? 0) >= 4) continue;

    const { data: payments } = await supabase
      .from(DB_TABLES.payments)
      .select("id, user_id, mp_payment_id, status")
      .eq("match_id", match.id)
      .eq("status", "approved");

    for (const payment of (payments ?? []) as PaymentRow[]) {
      const mpId = payment.mp_payment_id?.trim();
      if (mpId && mpId !== "dev_simulated") {
        try {
          await getPaymentRefundClient().total({ payment_id: mpId });
        } catch (e) {
          console.error("[cron refund]", e);
          continue;
        }
      }

      await supabase
        .from(DB_TABLES.payments)
        .update({ status: "refunded", updated_at: new Date().toISOString() })
        .eq("id", payment.id);

      await createNotification(supabase, {
        user_id: payment.user_id,
        type: "payment_rejected",
        title: "Reembolso procesado",
        body: "El partido no se completó con 4 jugadores. Tu dinero será devuelto.",
        match_id: match.id,
      });
    }

    await supabase
      .from(DB_TABLES.matches)
      .update({ match_status: "cancelled", payment_status: "refunded" })
      .eq("id", match.id);

    processed++;
  }

  return NextResponse.json({ ok: true, processed });
}
