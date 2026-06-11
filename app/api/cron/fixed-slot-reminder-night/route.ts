import { type NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

function getArgentinaTodayYmd(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function getTomorrowYmd(): string {
  const today = getArgentinaTodayYmd();
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function cronSecretFromRequest(req: NextRequest): string | null {
  const bearer = req.headers.get("authorization");
  const bearerSecret = bearer?.startsWith("Bearer ") ? bearer.slice("Bearer ".length).trim() : null;
  return req.headers.get("x-cron-secret")?.trim() ?? req.nextUrl.searchParams.get("secret") ?? bearerSecret;
}

export async function GET(req: NextRequest) {
  const secret = cronSecretFromRequest(req);
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const tomorrow = getTomorrowYmd();

  const { data: matches } = await supabase
    .from(DB_TABLES.matches)
    .select("id, scheduled_time")
    .eq("es_turno_fijo", true)
    .eq("scheduled_date", tomorrow)
    .neq("match_status", "cancelled");

  if (!matches?.length) return NextResponse.json({ ok: true, sent: 0 });

  let sent = 0;
  for (const match of matches as Array<{ id: string; scheduled_time: string | null }>) {
    const hora = String(match.scheduled_time ?? "").slice(0, 5);

    const { data: unconfirmed } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id")
      .eq("match_id", match.id)
      .is("attendance_status", null);

    for (const p of (unconfirmed ?? []) as Array<{ player_id: string }>) {
      await createNotification(supabase, {
        user_id: p.player_id,
        type: "match_reminder",
        title: "¡Mañana tenés turno fijo!",
        body: `Mañana a las ${hora} tenés un turno fijo. Ingresá a la app para confirmar tu asistencia.`,
        match_id: match.id,
      });
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
