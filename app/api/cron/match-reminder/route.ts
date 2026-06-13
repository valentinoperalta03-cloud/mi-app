import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { createNotification } from "@/lib/notifications";

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
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

  const tomorrow = addDaysYmd(getTodayYmdInArgentina(), 1);

  const { data: matches } = await supabase
    .from(DB_TABLES.matches)
    .select("id, scheduled_date, scheduled_time")
    .eq("scheduled_date", tomorrow)
    .in("match_status", ["reserved", "full"])
    .eq("match_24h_reminder_sent", false)
    .limit(50);

  if (!matches?.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;

  for (const match of matches as Array<{ id: string; scheduled_date: string | null; scheduled_time: string | null }>) {
    const { data: participants } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id")
      .eq("match_id", match.id);

    const time = String(match.scheduled_time ?? "").trim().slice(0, 5);

    for (const p of (participants ?? []) as Array<{ player_id: string }>) {
      await createNotification(supabase, {
        user_id: p.player_id,
        type: "match_reminder",
        title: "¡Tu partido es mañana!",
        body: time ? `Recordatorio: tenés un partido mañana a las ${time}. ¡Preparate!` : "Recordatorio: tenés un partido mañana. ¡Preparate!",
        match_id: match.id,
      });
    }

    await supabase
      .from(DB_TABLES.matches)
      .update({ match_24h_reminder_sent: true })
      .eq("id", match.id);

    processed++;
  }

  return NextResponse.json({ ok: true, processed });
}
