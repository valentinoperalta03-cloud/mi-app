import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";

type MatchRow = {
  id: string;
  owner_id: string | null;
};

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

  const thresholdIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: matches, error: fetchErr } = await supabase
    .from(DB_TABLES.matches)
    .select("id,owner_id")
    .eq("payment_status", "pending")
    .in("match_status", ["pending", "scheduled", "reserved"])
    .in("match_type", ["reservation", "amistoso", "competitivo"])
    .lt("created_at", thresholdIso);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  let cancelled = 0;
  for (const match of (matches ?? []) as MatchRow[]) {
    const { error: updateMatchErr } = await supabase
      .from(DB_TABLES.matches)
      .update({ match_status: "cancelled", payment_status: "expired" })
      .eq("id", match.id)
      .in("match_status", ["pending", "scheduled", "reserved"]);
    if (updateMatchErr) {
      log.warn({ event: "cron.expire_unpaid.match_update_skipped", matchId: match.id, err: updateMatchErr });
      continue;
    }

    await supabase
      .from(DB_TABLES.payments)
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("match_id", match.id);

    if (match.owner_id) {
      await createNotification(supabase, {
        user_id: match.owner_id,
        type: "reservation_cancelled",
        title: "Reserva expirada",
        body: "Tu reserva expiró por falta de pago.",
        match_id: match.id,
      });
    }
    cancelled++;
  }

  return NextResponse.json({ cancelled });
}
