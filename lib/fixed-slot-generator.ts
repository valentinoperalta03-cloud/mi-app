"server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";

export type SlotInput = {
  id: string;
  club_id: string;
  court_id: string;
  start_time: string;
  duration_minutes: number;
};

/**
 * Intenta crear el partido de un turno fijo para una fecha concreta.
 * No hace nada si ya existe, hay excepción o no hay jugadores.
 * Retorna true si creó el partido.
 */
export async function generateMatchForSlotOnDate(
  supabase: SupabaseClient,
  slot: SlotInput,
  targetDate: string
): Promise<boolean> {
  const { data: exception } = await supabase
    .from(DB_TABLES.fixedSlotExceptions)
    .select("id")
    .eq("fixed_slot_id", slot.id)
    .eq("exception_date", targetDate)
    .maybeSingle();
  if (exception) return false;

  const slotTime = String(slot.start_time).slice(0, 5);

  const { data: existing } = await supabase
    .from(DB_TABLES.matches)
    .select("id")
    .eq("court_id", slot.court_id)
    .eq("scheduled_date", targetDate)
    .eq("scheduled_time", slotTime)
    .eq("es_turno_fijo", true)
    .neq("match_status", "cancelled")
    .maybeSingle();
  if (existing) return false;

  const { data: playersRaw } = await supabase
    .from(DB_TABLES.fixedSlotPlayers)
    .select("player_id,created_at")
    .eq("fixed_slot_id", slot.id)
    .order("created_at", { ascending: true });
  const players = (playersRaw ?? []) as Array<{ player_id: string; created_at: string }>;
  if (players.length === 0) return false;

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
  if (matchErr || !matchInserted) return false;

  const matchId = String((matchInserted as { id: string }).id);

  await supabase.from(DB_TABLES.matchParticipants).insert(
    players.map((p) => ({ match_id: matchId, player_id: p.player_id }))
  );

  for (const player of players) {
    await supabase.from(DB_TABLES.payments).insert({
      match_id: matchId,
      user_id: player.player_id,
      status: "invited",
      amount: 0,
    });
    await createNotification(supabase, {
      user_id: player.player_id,
      type: "reservation_confirmed",
      title: "Turno fijo agendado",
      body: `Tu turno fijo del ${targetDate} fue agendado. Confirmá tu asistencia desde la app antes del horario indicado.`,
      match_id: matchId,
    });
  }

  return true;
}

/** Retorna las próximas fechas (yyyy-MM-dd) para un día de semana dentro de los próximos N días. */
export function getUpcomingDatesForDayOfWeek(
  dayOfWeek: number,
  fromDate: Date,
  daysAhead: number
): string[] {
  const dates: string[] = [];
  for (let i = 1; i <= daysAhead; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    if (d.getDay() === dayOfWeek) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  return dates;
}
