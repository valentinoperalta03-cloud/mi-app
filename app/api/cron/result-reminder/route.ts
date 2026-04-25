import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";

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

  const now = new Date().toISOString();

  const { data: matches } = await supabase
    .from(DB_TABLES.matches)
    .select("id, result_available_at, result_notified")
    .eq("match_status", "reserved")
    .eq("payment_status", "paid")
    .lte("result_available_at", now)
    .eq("result_notified", false)
    .limit(20);

  if (!matches?.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;
  for (const match of matches) {
    const { data: participants } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id")
      .eq("match_id", match.id);

    for (const p of participants ?? []) {
      await createNotification(supabase, {
        user_id: p.player_id,
        type: "result_pending",
        title: "¡Cargá el resultado!",
        body: "Tu partido terminó. Entrá a cargarlo para actualizar tu nivel.",
        match_id: match.id,
      });
    }

    await supabase
      .from(DB_TABLES.matches)
      .update({ result_notified: true })
      .eq("id", match.id);

    processed++;
  }

  return NextResponse.json({ ok: true, processed });
}
