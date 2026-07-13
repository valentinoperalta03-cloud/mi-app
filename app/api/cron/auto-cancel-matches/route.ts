import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";

type MatchRow = {
  id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  owner_id: string | null;
  financial_status: string | null;
  incomplete_reminder_sent: boolean | null;
  courts: { name: string | null } | { name: string | null }[] | null;
};

function courtName(row: MatchRow): string {
  const rel = Array.isArray(row.courts) ? row.courts[0] ?? null : row.courts;
  return String(rel?.name ?? "el club").trim() || "el club";
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
  const nowDate = now.toISOString().split("T")[0];
  const nowTime = now.toTimeString().slice(0, 5);

  const { data: matches } = await supabase
    .from(DB_TABLES.matches)
    .select("id, scheduled_date, scheduled_time, owner_id, financial_status, incomplete_reminder_sent, courts(name)")
    .in("match_status", ["scheduled", "full"])
    .lte("scheduled_date", nowDate)
    .neq("match_status", "cancelled");

  if (!matches?.length) {
    return NextResponse.json({ ok: true, processed: 0, notified: 0 });
  }

  let processed = 0;
  let notified = 0;

  for (const match of (matches ?? []) as MatchRow[]) {
    const scheduledDate = String(match.scheduled_date ?? "").trim();
    const scheduledTime = String(match.scheduled_time ?? "").trim().slice(0, 5);
    if (scheduledDate === nowDate && scheduledTime > nowTime) continue;

    const { count } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id", { count: "exact", head: true })
      .eq("match_id", match.id);

    if ((count ?? 0) >= 4) continue;

    const financialStatus = String(match.financial_status ?? "unpaid");

    // El club ya cobro la sena (o el total): el turno queda confirmado, la
    // decision de jugar con menos gente es del organizador. No se cancela.
    if (financialStatus === "partially_paid" || financialStatus === "fully_paid") {
      if (!match.incomplete_reminder_sent && match.owner_id) {
        const missing = Math.max(0, 4 - (count ?? 0));
        await supabase
          .from(DB_TABLES.matches)
          .update({ incomplete_reminder_sent: true })
          .eq("id", match.id);
        await createNotification(supabase, {
          user_id: match.owner_id,
          type: "match_reminder",
          title: "Partido confirmado, faltan jugadores",
          body: `Tu partido en ${courtName(match)} está confirmado pero todavía ${missing === 1 ? "falta" : "faltan"} ${missing} jugador${missing === 1 ? "" : "es"}. ¿Querés compartir el link?`,
          match_id: match.id,
        });
        notified++;
      }
      continue;
    }

    const { data: participantRows } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id")
      .eq("match_id", match.id);

    for (const row of (participantRows ?? []) as Array<{ player_id: string }>) {
      await createNotification(supabase, {
        user_id: row.player_id,
        type: "reservation_cancelled",
        title: "Partido cancelado",
        body: "El partido se canceló porque no se completó el pago de la seña a tiempo.",
        match_id: match.id,
      });
    }

    await supabase
      .from(DB_TABLES.matches)
      .update({ match_status: "cancelled" })
      .eq("id", match.id)
      .in("match_status", ["scheduled", "full"]);

    processed++;
  }

  return NextResponse.json({ ok: true, processed, notified });
}
