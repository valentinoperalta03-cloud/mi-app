import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/utils/supabase/server";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";

/**
 * Cuando se cancela un match de turno fijo, insertar la excepción para que
 * el generador no vuelva a crear un match para esa fecha. No-op si el match
 * no es turno fijo.
 */
export async function insertFixedSlotExceptionIfNeeded(matchId: string): Promise<void> {
  if (!matchId) return;
  const supabase = createServiceClient();

  const { data: match } = await supabase
    .from(DB_TABLES.matches)
    .select("es_turno_fijo, fixed_slot_id, scheduled_date")
    .eq("id", matchId)
    .maybeSingle();
  const typed = match as { es_turno_fijo: boolean | null; fixed_slot_id: string | null; scheduled_date: string | null } | null;

  if (!typed?.es_turno_fijo || !typed.fixed_slot_id || !typed.scheduled_date) return;

  await supabase.from(DB_TABLES.fixedSlotExceptions).upsert(
    { fixed_slot_id: typed.fixed_slot_id, exception_date: typed.scheduled_date },
    { onConflict: "fixed_slot_id,exception_date", ignoreDuplicates: true }
  );
}

/** Resultado de la parte de DB: qué cambió realmente en ESTA corrida. */
export type FixedSlotExceptionDbResult = {
  ok: boolean;
  error: string | null;
  /** La excepción no existía y la creó esta corrida. */
  exceptionCreated: boolean;
  /** Match que esta corrida pasó a `cancelled`. Null si ya estaba cancelado o no existía. */
  cancelledMatchId: string | null;
  /** A quién avisar. Vacío cuando esta corrida no cambió nada (reintento). */
  notifyPlayerIds: string[];
};

/**
 * Parte de DB de "saltear una ocurrencia de turno fijo", sin notificaciones.
 *
 * Idempotente por diseño: si la excepción ya existe no la duplica, y solo
 * cancela el match si todavía está vivo. Nunca revive un match cancelado ni
 * toca campos financieros. Un reintento después de una falla parcial termina
 * el trabajo y devuelve `notifyPlayerIds` vacío para lo que ya estaba hecho,
 * así que no se reenvían avisos.
 */
export async function ensureFixedSlotExceptionForDate(
  supabase: SupabaseClient,
  params: { fixedSlotId: string; exceptionDate: string; reason?: string | null; cancelledBy?: string | null }
): Promise<FixedSlotExceptionDbResult> {
  const { fixedSlotId, exceptionDate } = params;
  const empty: FixedSlotExceptionDbResult = {
    ok: false,
    error: null,
    exceptionCreated: false,
    cancelledMatchId: null,
    notifyPlayerIds: [],
  };
  if (!fixedSlotId || !exceptionDate) return { ...empty, error: "Datos incompletos." };

  const { data: existingException } = await supabase
    .from(DB_TABLES.fixedSlotExceptions)
    .select("id")
    .eq("fixed_slot_id", fixedSlotId)
    .eq("exception_date", exceptionDate)
    .maybeSingle();

  let exceptionCreated = false;
  if (!existingException) {
    const { error } = await supabase.from(DB_TABLES.fixedSlotExceptions).insert({
      fixed_slot_id: fixedSlotId,
      exception_date: exceptionDate,
      reason: params.reason || null,
      cancelled_by: params.cancelledBy || null,
    });
    // 23505 = otra corrida la insertó entre el select y el insert: no es un fallo.
    if (error && error.code !== "23505") {
      return { ...empty, error: error.message };
    }
    exceptionCreated = !error;
  }

  const { data: existingMatch } = await supabase
    .from(DB_TABLES.matches)
    .select("id")
    .eq("fixed_slot_id", fixedSlotId)
    .eq("scheduled_date", exceptionDate)
    .eq("es_turno_fijo", true)
    .neq("match_status", "cancelled")
    .maybeSingle();

  if (!existingMatch) {
    // Sin ocurrencia generada. Solo se avisa si la excepción es nueva; en un
    // reintento la excepción ya existía y no hay nada que comunicar de nuevo.
    if (!exceptionCreated) return { ok: true, error: null, exceptionCreated: false, cancelledMatchId: null, notifyPlayerIds: [] };
    const { data: players } = await supabase
      .from(DB_TABLES.fixedSlotPlayers)
      .select("player_id")
      .eq("fixed_slot_id", fixedSlotId);
    return {
      ok: true,
      error: null,
      exceptionCreated: true,
      cancelledMatchId: null,
      notifyPlayerIds: ((players ?? []) as Array<{ player_id: string }>).map((p) => p.player_id),
    };
  }

  const matchId = String((existingMatch as { id: string }).id);
  // El .neq extra hace que una cancelación concurrente no se aplique dos veces:
  // si otro proceso ya lo canceló, `updated` vuelve vacío y no se notifica.
  const { data: updated, error: updateErr } = await supabase
    .from(DB_TABLES.matches)
    .update({ match_status: "cancelled" })
    .eq("id", matchId)
    .neq("match_status", "cancelled")
    .select("id");
  if (updateErr) {
    return { ...empty, exceptionCreated, error: updateErr.message };
  }
  if (!updated || updated.length === 0) {
    return { ok: true, error: null, exceptionCreated, cancelledMatchId: null, notifyPlayerIds: [] };
  }

  const { data: matchParticipants } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id")
    .eq("match_id", matchId);

  return {
    ok: true,
    error: null,
    exceptionCreated,
    cancelledMatchId: matchId,
    notifyPlayerIds: ((matchParticipants ?? []) as Array<{ player_id: string }>).map((p) => p.player_id),
  };
}

/**
 * Parte de avisos, separada de la DB a propósito: OneSignal es un servicio
 * externo y una push caída no puede dejar la base a medio camino. Nunca lanza.
 */
export async function notifyFixedSlotExceptionRecipients(
  supabase: SupabaseClient,
  params: { playerIds: string[]; matchId: string | null; body: string }
): Promise<void> {
  for (const playerId of new Set(params.playerIds)) {
    try {
      await createNotification(supabase, {
        user_id: playerId,
        type: "reservation_cancelled",
        title: "Turno fijo cancelado",
        body: params.body,
        ...(params.matchId ? { match_id: params.matchId } : {}),
      });
    } catch (err) {
      console.error("[fixed-slot-exception] no se pudo notificar", playerId, err);
    }
  }
}

export type ApplyFixedSlotExceptionResult = {
  ok: boolean;
  /** Id del match que se canceló, o null si no había ocurrencia generada. */
  cancelledMatchId: string | null;
};

/**
 * Saltea UNA ocurrencia de un turno fijo sin tocar la recurrencia:
 * 1. deja la excepción cargada para esa fecha (el generador deja de crearla),
 * 2. cancela el match ya generado si existe,
 * 3. avisa a los jugadores.
 *
 * `fixed_slots` nunca se modifica: los jueves siguientes siguen existiendo.
 * Es la primitiva única detrás de "No viene esta semana" (/admin/turnos-fijos).
 * El cierre de un día completo (/admin/bloqueos) usa las dos mitades por
 * separado, para hacer toda la DB primero y los avisos después.
 */
export async function applyFixedSlotExceptionForDate(
  supabase: SupabaseClient,
  params: {
    fixedSlotId: string;
    exceptionDate: string;
    slotTime: string;
    reason?: string | null;
    cancelledBy?: string | null;
    /** Cuerpo del aviso cuando había un partido generado. */
    bodyWithMatch?: string;
    /** Cuerpo del aviso cuando todavía no había partido generado. */
    bodyWithoutMatch?: string;
  }
): Promise<ApplyFixedSlotExceptionResult> {
  const slotTime = String(params.slotTime ?? "").slice(0, 5);
  const result = await ensureFixedSlotExceptionForDate(supabase, {
    fixedSlotId: params.fixedSlotId,
    exceptionDate: params.exceptionDate,
    reason: params.reason,
    cancelledBy: params.cancelledBy,
  });
  if (!result.ok) return { ok: false, cancelledMatchId: null };

  if (result.notifyPlayerIds.length > 0) {
    const body = result.cancelledMatchId
      ? params.bodyWithMatch ??
        `El club canceló el turno del ${params.exceptionDate} a las ${slotTime}. El horario quedó libre.`
      : params.bodyWithoutMatch ?? `El club canceló el turno del ${params.exceptionDate} a las ${slotTime}.`;
    await notifyFixedSlotExceptionRecipients(supabase, {
      playerIds: result.notifyPlayerIds,
      matchId: result.cancelledMatchId,
      body,
    });
  }

  return { ok: true, cancelledMatchId: result.cancelledMatchId };
}
