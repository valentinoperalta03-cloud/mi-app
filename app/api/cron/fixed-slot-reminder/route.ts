import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

function getArgentinaNow() {
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const y = dateParts.find((p) => p.type === "year")?.value ?? "1970";
  const m = dateParts.find((p) => p.type === "month")?.value ?? "01";
  const d = dateParts.find((p) => p.type === "day")?.value ?? "01";
  const hh = timeParts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = timeParts.find((p) => p.type === "minute")?.value ?? "00";
  return { date: `${y}-${m}-${d}`, minutes: Number(hh) * 60 + Number(mm) };
}

function toMinutes(t: string) {
  const value = String(t).slice(0, 5);
  const [h, m] = value.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const nowAr = getArgentinaNow();
  const fromMin = nowAr.minutes + 240;
  const toMin = nowAr.minutes + 300;

  const { data: matchesRaw } = await supabase
    .from(DB_TABLES.matches)
    .select("id,scheduled_time,scheduled_date,court_id,fixed_slot_id,courts(name,club_id)")
    .eq("es_turno_fijo", true)
    .eq("scheduled_date", nowAr.date)
    .not("fixed_slot_id", "is", null)
    .neq("match_status", "cancelled");
  const matches = (matchesRaw ?? []) as unknown as Array<{
    id: string;
    scheduled_time: string | null;
    scheduled_date: string | null;
    court_id: string;
    fixed_slot_id: string | null;
    courts: { name: string | null; club_id: string | null } | { name: string | null; club_id: string | null }[] | null;
  }>;

  let notified = 0;
  for (const match of matches) {
    const slotMin = toMinutes(String(match.scheduled_time ?? ""));
    if (slotMin < fromMin || slotMin >= toMin) continue;
    const fixedSlotId = String(match.fixed_slot_id ?? "");
    if (!fixedSlotId) continue;

    const { data: slotPlayersRaw } = await supabase
      .from(DB_TABLES.fixedSlotPlayers)
      .select("player_id")
      .eq("fixed_slot_id", fixedSlotId);
    const slotPlayers = (slotPlayersRaw ?? []) as Array<{ player_id: string }>;
    if (slotPlayers.length === 0) continue;

    const playerIds = slotPlayers.map((p) => p.player_id);
    const { data: unpaidPaymentsRaw } = await supabase
      .from(DB_TABLES.payments)
      .select("user_id,status")
      .eq("match_id", match.id)
      .in("user_id", playerIds)
      .neq("status", "approved");
    const unpaidPayments = (unpaidPaymentsRaw ?? []) as Array<{ user_id: string; status: string | null }>;
    if (unpaidPayments.length === 0) continue;

    const unpaidIds = unpaidPayments.map((p) => p.user_id);
    const { data: profilesRaw } = await supabase
      .from(DB_TABLES.profiles)
      .select("user_id,name")
      .in("user_id", unpaidIds);
    const names = (profilesRaw ?? [])
      .map((p: { user_id: string; name: string | null }) => p.name ?? "Jugador")
      .join(", ");

    const courtRel = Array.isArray(match.courts) ? match.courts[0] ?? null : match.courts;
    const clubId = String(courtRel?.club_id ?? "");
    if (!clubId) continue;
    const { data: clubRow } = await supabase
      .from(DB_TABLES.clubs)
      .select("owner_id")
      .eq("id", clubId)
      .maybeSingle();
    const ownerId = String((clubRow as { owner_id?: string | null } | null)?.owner_id ?? "");
    if (!ownerId) continue;

    await createNotification(supabase, {
      user_id: ownerId,
      type: "match_reminder",
      title: "Jugadores sin confirmar en turno fijo",
      body: `El turno de las ${String(match.scheduled_time ?? "").slice(0, 5)} en ${courtRel?.name ?? "cancha"} tiene jugadores que no confirmaron: ${names}.`,
      match_id: match.id,
    });
    notified += 1;
  }

  return NextResponse.json({ ok: true, notified });
}
