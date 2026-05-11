import { addDays, format } from "date-fns";
import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

function getArgentinaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return new Date(`${y}-${m}-${d}T12:00:00`);
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const targetDateObj = addDays(getArgentinaNow(), 7);
  const targetDate = format(targetDateObj, "yyyy-MM-dd");
  const dayOfWeek = targetDateObj.getDay();

  const { data: slotsRaw } = await supabase
    .from(DB_TABLES.fixedSlots)
    .select("id,club_id,court_id,day_of_week,start_time,duration_minutes,is_active")
    .eq("is_active", true)
    .eq("day_of_week", dayOfWeek);
  const slots = (slotsRaw ?? []) as Array<{
    id: string;
    club_id: string;
    court_id: string;
    day_of_week: number;
    start_time: string;
    duration_minutes: number;
    is_active: boolean;
  }>;

  let created = 0;
  for (const slot of slots) {
    const { data: exception } = await supabase
      .from(DB_TABLES.fixedSlotExceptions)
      .select("id")
      .eq("fixed_slot_id", slot.id)
      .eq("exception_date", targetDate)
      .maybeSingle();
    if (exception) continue;

    const slotTime = String(slot.start_time).slice(0, 5);
    const { data: existing } = await supabase
      .from(DB_TABLES.matches)
      .select("id")
      .eq("court_id", slot.court_id)
      .eq("scheduled_date", targetDate)
      .eq("scheduled_time", slotTime)
      .neq("match_status", "cancelled")
      .maybeSingle();
    if (existing) continue;

    const { data: playersRaw } = await supabase
      .from(DB_TABLES.fixedSlotPlayers)
      .select("player_id,created_at")
      .eq("fixed_slot_id", slot.id)
      .order("created_at", { ascending: true });
    const players = (playersRaw ?? []) as Array<{
      player_id: string;
      created_at: string;
    }>;
    if (players.length === 0) continue;

    const { data: clubRow } = await supabase
      .from(DB_TABLES.clubs)
      .select("name")
      .eq("id", slot.club_id)
      .maybeSingle();
    const clubName = String((clubRow as { name?: string | null } | null)?.name ?? "Club");

    const { data: matchInserted, error: matchErr } = await supabase
      .from(DB_TABLES.matches)
      .insert({
        match_type: "reservation",
        match_status: "scheduled",
        payment_status: "pending",
        scheduled_date: targetDate,
        scheduled_time: slotTime,
        duration_minutes: slot.duration_minutes || 90,
        court_id: slot.court_id,
        owner_id: players[0].player_id,
        location_name: clubName,
        date: new Date(`${targetDate}T${slotTime}:00`).toISOString(),
        es_turno_fijo: true,
        fixed_slot_id: slot.id,
      })
      .select("id")
      .single();
    if (matchErr || !matchInserted) continue;

    const matchId = String((matchInserted as { id: string }).id);

    await supabase.from(DB_TABLES.matchParticipants).insert(
      players.map((p) => ({
        match_id: matchId,
        player_id: p.player_id,
      }))
    );

    for (const player of players) {
      await supabase.from(DB_TABLES.payments).insert({
        match_id: matchId,
        user_id: player.player_id,
        status: "invited",
        amount: 0,
        marketplace_fee: 0,
      });

      await createNotification(supabase, {
        user_id: player.player_id,
        type: "join_request",
        title: "Turno fijo generado",
        body: `Tenés un turno fijo pendiente de pago para el ${targetDate}.`,
        match_id: matchId,
      });
    }

    created += 1;
  }

  return NextResponse.json({ ok: true, targetDate, created });
}
