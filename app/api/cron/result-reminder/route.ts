import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";

const DEFAULT_DURATION_MINUTES = 90;

type MatchCandidate = {
  id: string;
  date: string | null;
  duration_minutes: number | null;
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

  const now = Date.now();

  // result_available_at nunca se escribe en ningún lado, asi que el filtro
  // original nunca traía resultados. En su lugar calculamos el fin del
  // partido con date + duration_minutes (ambas columnas ya se llenan al
  // crear el partido) y filtramos en memoria.
  const { data: candidates, error: fetchErr } = await supabase
    .from(DB_TABLES.matches)
    .select("id, date, duration_minutes")
    .eq("match_status", "reserved")
    .eq("payment_status", "paid")
    .eq("result_notified", false)
    .lte("date", new Date(now).toISOString())
    .limit(100);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const ended = ((candidates ?? []) as MatchCandidate[])
    .filter((m) => {
      if (!m.date) return false;
      const duration = m.duration_minutes && m.duration_minutes > 0 ? m.duration_minutes : DEFAULT_DURATION_MINUTES;
      const endsAt = new Date(m.date).getTime() + duration * 60_000;
      return now > endsAt;
    })
    .slice(0, 20);

  if (!ended.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const { data: existingResults } = await supabase
    .from(DB_TABLES.matchResults)
    .select("match_id")
    .in("match_id", ended.map((m) => m.id));
  const matchesWithResult = new Set(
    ((existingResults ?? []) as Array<{ match_id: string }>).map((r) => r.match_id)
  );

  const pending = ended.filter((m) => !matchesWithResult.has(m.id));

  let processed = 0;
  for (const match of pending) {
    const { data: participants } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id")
      .eq("match_id", match.id);

    for (const p of (participants ?? []) as Array<{ player_id: string }>) {
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
