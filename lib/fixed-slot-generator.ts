"server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCourtSlotPrice } from "@/lib/court-pricing";
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
  | { created: false; reason: string; wouldCreate?: boolean };

/** Motivo de omisión cuando el club marcó esa fecha como cerrada. */
export const CLOSED_DAY_SKIP_REASON = "el club está cerrado esa fecha";
export const EXCEPTION_SKIP_REASON = "hay una excepción cargada para esa fecha";
export const EXISTING_SKIP_REASON = "ya existe un match de turno fijo para esa fecha/hora";
export const INACTIVE_SKIP_REASON = "el turno fijo está dado de baja";
export const PAST_SKIP_REASON = "el horario de esa fecha ya pasó";

/**
 * Omisiones esperables que no son conflictos a reportar. Cualquier otro motivo
 * (cancha ocupada, bloqueo, error de DB) sí lo es.
 */
export const BENIGN_SKIP_REASONS = new Set([
  CLOSED_DAY_SKIP_REASON,
  EXCEPTION_SKIP_REASON,
  EXISTING_SKIP_REASON,
  INACTIVE_SKIP_REASON,
  PAST_SKIP_REASON,
]);

const REASON_BY_RPC_STATUS: Record<string, string> = {
  not_found: "el turno fijo no existe",
  inactive: INACTIVE_SKIP_REASON,
  wrong_day: "la fecha no corresponde al día del turno fijo",
  past: PAST_SKIP_REASON,
  exception: EXCEPTION_SKIP_REASON,
  closed_day: CLOSED_DAY_SKIP_REASON,
  exists: EXISTING_SKIP_REASON,
  occupied: "la cancha ya está ocupada por otra reserva o partido en ese rango",
  blocked: "la cancha tiene un bloqueo en ese rango",
  no_owner: "no hay owner_id disponible",
};

type RpcOutcome = { status: string; matchId: string | null } | { error: string };

/**
 * Única decisión de "¿se puede crear esta ocurrencia?": la RPC
 * generate_fixed_slot_occurrence revisa activo, día, futuro, excepción, día
 * cerrado, dedupe por recurrencia, ocupación por rango y bloqueos bajo lock, y
 * recién ahí inserta. Un error de DB nunca se interpreta como "libre".
 */
async function runGenerateRpc(
  supabase: SupabaseClient,
  params: {
    fixedSlotId: string;
    date: string;
    ownerId: string | null;
    locationName: string | null;
    totalPrice: number;
    dryRun: boolean;
  }
): Promise<RpcOutcome> {
  const { data, error } = await supabase.rpc("generate_fixed_slot_occurrence", {
    p_fixed_slot_id: params.fixedSlotId,
    p_date: params.date,
    p_owner_id: params.ownerId,
    p_location_name: params.locationName,
    p_total_price: params.totalPrice,
    p_dry_run: params.dryRun,
  });
  if (error) return { error: error.message };
  const row = data as { status?: string; match_id?: string | null } | null;
  if (!row?.status) return { error: "respuesta vacía de generate_fixed_slot_occurrence" };
  return { status: row.status, matchId: row.match_id ?? null };
}

/**
 * Intenta crear el partido de un turno fijo para una fecha concreta. Retorna el
 * motivo cuando no crea nada, para poder diagnosticar por qué una cancha no
 * quedó bloqueada. Con `dryRun` corre exactamente los mismos chequeos sin
 * escribir nada.
 */
export async function generateMatchForSlotOnDate(
  supabase: SupabaseClient,
  slot: SlotInput,
  targetDate: string,
  options: { dryRun?: boolean } = {}
): Promise<GenerateMatchResult> {
  const logPrefix = `[fixed-slot-generator] slot=${slot.id} fecha=${targetDate}`;
  const failClosed = (reason: string): GenerateMatchResult => {
    console.error(`${logPrefix}: NO se creó el match (fail closed) — ${reason}`);
    return { created: false, reason };
  };
  const skip = (status: string): GenerateMatchResult => {
    const reason = REASON_BY_RPC_STATUS[status] ?? `estado desconocido: ${status}`;
    console.log(`${logPrefix}: omitido — ${reason}`);
    return { created: false, reason };
  };

  // Chequeo previo barato: la mayoría de las corridas del cron terminan acá
  // (ya existe, excepción, etc.) sin leer jugadores ni precio.
  const pre = await runGenerateRpc(supabase, {
    fixedSlotId: slot.id,
    date: targetDate,
    ownerId: null,
    locationName: null,
    totalPrice: 0,
    dryRun: true,
  });
  if ("error" in pre) return failClosed(`error verificando la ocurrencia: ${pre.error}`);
  if (pre.status !== "would_create") return skip(pre.status);
  if (options.dryRun) return { created: false, reason: "dry-run: se crearía", wouldCreate: true };

  const { data: playersRaw, error: playersErr } = await supabase
    .from(DB_TABLES.fixedSlotPlayers)
    .select("player_id,created_at")
    .eq("fixed_slot_id", slot.id)
    .order("created_at", { ascending: true });
  if (playersErr) return failClosed(`error leyendo jugadores: ${playersErr.message}`);
  const players = (playersRaw ?? []) as Array<{ player_id: string; created_at: string }>;

  const { data: clubRow, error: clubErr } = await supabase
    .from(DB_TABLES.clubs)
    .select("name,owner_id")
    .eq("id", slot.club_id)
    .maybeSingle();
  if (clubErr) return failClosed(`error leyendo el club: ${clubErr.message}`);
  const club = clubRow as { name?: string | null; owner_id?: string | null } | null;
  const clubName = String(club?.name ?? "Club");

  // El turno bloquea la cancha aunque todavía no tenga jugadores asignados
  // (título solo, sin gente). En ese caso el match queda a nombre del dueño
  // del club — no hay ningún jugador real al que asignarle el owner_id.
  const ownerId = players[0]?.player_id ?? club?.owner_id ?? null;
  if (!ownerId) {
    return failClosed("no hay owner_id disponible (sin jugadores asignados y sin owner_id en el club)");
  }

  // matches.owner_id tiene FK a profiles. Los jugadores siempre tienen fila en
  // profiles (se buscan desde esa misma tabla), pero el dueño del club
  // (fallback cuando el turno no tiene jugadores todavía) puede no tenerla —
  // los admins no pasan necesariamente por el flujo que crea el profile de
  // jugador. Sin esto, el insert fallaba en silencio y la cancha nunca quedaba
  // bloqueada.
  if (!players[0]) {
    const { data: ownerProfile, error: profileReadErr } = await supabase
      .from(DB_TABLES.profiles)
      .select("user_id")
      .eq("user_id", ownerId)
      .maybeSingle();
    if (profileReadErr) return failClosed(`error leyendo el profile del dueño: ${profileReadErr.message}`);
    if (!ownerProfile) {
      // profiles.id es NOT NULL y no tiene default en la DB — hay que setearlo
      // explícito. Sigue la convención estándar de Supabase: id = auth.users.id,
      // igual que user_id (quedan duplicados a propósito, el resto del código
      // lee por user_id).
      const { error: profileErr } = await supabase
        .from(DB_TABLES.profiles)
        .insert({ id: ownerId, user_id: ownerId, name: clubName });
      if (profileErr && profileErr.code !== "23505") {
        return failClosed(`no se pudo asegurar el profile del dueño del club: ${profileErr.message}`);
      }
    }
  }

  // Precio efectivo de ESTA ocurrencia (día + horario), no el precio base de la
  // cancha: un turno fijo del lunes 19:30 se cobra lo que vale el lunes 19:30.
  const slotTime = String(slot.start_time).slice(0, 5);
  const totalPrice = await resolveCourtSlotPrice({
    supabase,
    courtId: slot.court_id,
    date: targetDate,
    startTime: slotTime,
  });

  const result = await runGenerateRpc(supabase, {
    fixedSlotId: slot.id,
    date: targetDate,
    ownerId,
    locationName: clubName,
    totalPrice,
    dryRun: false,
  });
  if ("error" in result) return failClosed(`error creando la ocurrencia: ${result.error}`);
  if (result.status !== "created" || !result.matchId) return skip(result.status);

  const matchId = result.matchId;
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
