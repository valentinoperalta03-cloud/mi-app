import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";

/**
 * Cancela cualquier partido abierto (match_type: 'amistoso') que exista
 * en la misma cancha/fecha/horario que la reserva que se acaba de confirmar.
 * Notifica a todos los jugadores anotados.
 */
export async function cancelConflictingOpenMatches(
  supabase: SupabaseClient,
  courtId: string,
  scheduledDate: string,
  scheduledTime: string // HH:MM normalizado
): Promise<void> {
  // Buscar partidos abiertos en conflicto
  const { data: conflictingMatches } = await supabase
    .from(DB_TABLES.matches)
    .select("id, owner_id, location_name")
    .eq("court_id", courtId)
    .eq("scheduled_date", scheduledDate)
    .eq("scheduled_time", scheduledTime)
    .eq("match_type", "amistoso")
    .neq("match_status", "cancelled");

  if (!conflictingMatches || conflictingMatches.length === 0) return;

  for (const match of conflictingMatches as Array<{
    id: string;
    owner_id: string | null;
    location_name: string | null;
  }>) {
    // Cancelar el partido
    await supabase.from(DB_TABLES.matches).update({ match_status: "cancelled" }).eq("id", match.id);

    const locationLabel = match.location_name?.trim() || "el club";

    // Obtener todos los jugadores anotados
    const { data: participants } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id")
      .eq("match_id", match.id);

    // Notificar a cada jugador
    for (const p of (participants ?? []) as Array<{ player_id: string }>) {
      await createNotification(supabase, {
        user_id: p.player_id,
        type: "match_cancelled",
        title: "❌ Partido cancelado",
        body: `El partido en ${locationLabel} el ${scheduledDate} a las ${scheduledTime} fue cancelado porque alguien reservó esa cancha.`,
        match_id: match.id,
      });
    }
  }
}
