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
  const today = getArgentinaTodayYmd();

  const { data: matches } = await supabase
    .from(DB_TABLES.matches)
    .select("id, scheduled_time")
    .eq("es_turno_fijo", true)
    .eq("scheduled_date", today)
    .neq("match_status", "cancelled");

  if (!matches?.length) return NextResponse.json({ ok: true, sent: 0 });

  let sent = 0;
  for (const match of matches as Array<{ id: string; scheduled_time: string | null }>) {
    const hora = String(match.scheduled_time ?? "").slice(0, 5);

    // Los turnos fijos sin jugadores asignados no tienen filas en match_participants
    // (ver lib/fixed-slot-generator.ts), así que esta query ya no devuelve nada para
    // ellos y no se envía ningún recordatorio.
    const { data: confirmed } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id")
      .eq("match_id", match.id)
      .eq("attendance_status", "confirmed");

    for (const p of (confirmed ?? []) as Array<{ player_id: string }>) {
      await createNotification(supabase, {
        user_id: p.player_id,
        type: "match_reminder",
        title: "¡Hoy tenés turno fijo!",
        body: `Hoy a las ${hora} tenés turno fijo. ¡Que lo disfrutes!`,
        match_id: match.id,
      });
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
