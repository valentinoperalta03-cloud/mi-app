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

export type GenerateMatchResult =
  | { created: true; matchId: string }
  | { created: false; reason: string };

/**
 * Intenta crear el partido de un turno fijo para una fecha concreta.
 * No hace nada si ya existe, hay excepción o no hay owner_id disponible.
 * Retorna el resultado con el motivo cuando no crea nada, para poder
 * diagnosticar por qué una cancha no quedó bloqueada.
 */
export async function generateMatchForSlotOnDate(
  supabase: SupabaseClient,
  slot: SlotInput,
  targetDate: string
): Promise<GenerateMatchResult> {
  const logPrefix = `[fixed-slot-generator] slot=${slot.id} fecha=${targetDate}`;

  const { data: exception } = await supabase
    .from(DB_TABLES.fixedSlotExceptions)
    .select("id")
    .eq("fixed_slot_id", slot.id)
    .eq("exception_date", targetDate)
    .maybeSingle();
  if (exception) {
    const reason = "hay una excepción cargada para esa fecha";
    console.log(`${logPrefix}: omitido — ${reason}`);
    return { created: false, reason };
  }

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
  if (existing) {
    const reason = "ya existe un match de turno fijo para esa fecha/hora";
    console.log(`${logPrefix}: omitido — ${reason}`);
    return { created: false, reason };
  }

  const { data: playersRaw } = await supabase
    .from(DB_TABLES.fixedSlotPlayers)
    .select("player_id,created_at")
    .eq("fixed_slot_id", slot.id)
    .order("created_at", { ascending: true });
  const players = (playersRaw ?? []) as Array<{ player_id: string; created_at: string }>;

  const { data: clubRow } = await supabase
    .from(DB_TABLES.clubs)
    .select("name,owner_id")
    .eq("id", slot.club_id)
    .maybeSingle();
  const club = clubRow as { name?: string | null; owner_id?: string | null } | null;
  const clubName = String(club?.name ?? "Club");

  // El turno bloquea la cancha aunque todavía no tenga jugadores asignados
  // (título solo, sin gente). En ese caso el match queda a nombre del dueño
  // del club — no hay ningún jugador real al que asignarle el owner_id.
  const ownerId = players[0]?.player_id ?? club?.owner_id ?? null;
  if (!ownerId) {
    const reason = "no hay owner_id disponible (sin jugadores asignados y sin owner_id en el club)";
    console.error(`${logPrefix}: NO se creó el match — ${reason}`);
    return { created: false, reason };
  }

  // matches.owner_id tiene FK a profiles. Los jugadores siempre tienen fila en
  // profiles (se buscan desde esa misma tabla), pero el dueño del club
  // (fallback cuando el turno no tiene jugadores todavía) puede no tenerla —
  // los admins no pasan necesariamente por el flujo que crea el profile de
  // jugador. Sin esto, el insert de abajo fallaba en silencio y la cancha
  // nunca quedaba bloqueada.
  if (!players[0]) {
    if (!club?.owner_id) {
      const reason = "owner_id es null";
      console.error(`${logPrefix}: NO se creó el match — ${reason} (el club ${slot.club_id} no tiene owner_id)`);
      return { created: false, reason };
    }

    const { data: ownerProfile } = await supabase
      .from(DB_TABLES.profiles)
      .select("user_id")
      .eq("user_id", ownerId)
      .maybeSingle();
    if (!ownerProfile) {
      // profiles.id es NOT NULL y no tiene default en la DB — hay que setearlo
      // explícito. Sigue la convención estándar de Supabase: id = auth.users.id,
      // igual que user_id (quedan duplicados a propósito, el resto del código
      // lee por user_id).
      const { error: profileErr } = await supabase
        .from(DB_TABLES.profiles)
        .insert({ id: ownerId, user_id: ownerId, name: clubName });
      if (profileErr && profileErr.code !== "23505") {
        const reason = `no se pudo asegurar el profile del dueño del club: ${profileErr.message}`;
        console.error(`${logPrefix}: NO se creó el match — ${reason}`);
        return { created: false, reason };
      }
    }
  }

  const { data: court } = await supabase
    .from(DB_TABLES.courts)
    .select("price")
    .eq("id", slot.court_id)
    .maybeSingle();
  const totalPrice = Number((court as { price?: number } | null)?.price ?? 0);

  const { data: matchInserted, error: matchErr } = await supabase
    .from(DB_TABLES.matches)
    .insert({
      match_type: "reservation",
      match_status: "scheduled",
      payment_status: "pending",
      financial_status: "unpaid",
      total_price: totalPrice,
      amount_pending: totalPrice,
      scheduled_date: targetDate,
      scheduled_time: slotTime,
      duration_minutes: slot.duration_minutes || 90,
      court_id: slot.court_id,
      owner_id: ownerId,
      location_name: clubName,
      date: `${targetDate}T${slotTime}:00`,
      es_turno_fijo: true,
      fixed_slot_id: slot.id,
    })
    .select("id")
    .single();
  if (matchErr || !matchInserted) {
    const reason = matchErr?.message ?? "insert sin error pero sin id devuelto";
    console.error(`${logPrefix}: NO se creó el match — error de insert: ${reason}`);
    return { created: false, reason };
  }

  const matchId = String((matchInserted as { id: string }).id);
  console.log(`${logPrefix}: match creado OK (matchId=${matchId})`);

  if (players.length > 0) {
    await supabase.from(DB_TABLES.matchParticipants).insert(
      players.map((p) => ({ match_id: matchId, player_id: p.player_id }))
    );
  }

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

  return { created: true, matchId };
}

/**
 * Retorna las próximas fechas (yyyy-MM-dd) para un día de semana dentro de los
 * próximos N días, INCLUYENDO hoy si hoy es ese día de semana (i arranca en 0).
 * Antes arrancaba en 1 y se saltaba la ocurrencia de hoy: si hoy era miércoles
 * y se creaba un turno fijo para los miércoles, la cancha no se bloqueaba hasta
 * la semana siguiente. El caller es responsable de descartar la fecha de hoy
 * si el horario ya pasó.
 */
export function getUpcomingDatesForDayOfWeek(
  dayOfWeek: number,
  fromDate: Date,
  daysAhead: number
): string[] {
  const dates: string[] = [];
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    if (d.getDay() === dayOfWeek) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  return dates;
}
