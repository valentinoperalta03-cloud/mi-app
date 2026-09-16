import type { SupabaseClient } from "@supabase/supabase-js";
import { isBookingConfirmed, isLateCancellation, resolveCancellationHours } from "@/lib/cancellation-policy";
import { utcMsForArgentinaWallClock } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";

/**
 * Resolución server-side de la ventana de cancelación: match → court → club.
 * El cliente nunca envía estas horas. Si el club no la tiene configurada cae al
 * default de `resolveCancellationHours`.
 */
export async function resolveClubCancellationHours(
  supabase: SupabaseClient,
  courtId: string
): Promise<number> {
  if (!courtId) return resolveCancellationHours(null);
  const { data: court } = await supabase
    .from(DB_TABLES.courts)
    .select("club_id")
    .eq("id", courtId)
    .maybeSingle();
  const clubId = String((court as { club_id?: string | null } | null)?.club_id ?? "").trim();
  if (!clubId) return resolveCancellationHours(null);
  const { data: club } = await supabase
    .from(DB_TABLES.clubs)
    .select("cancellation_hours")
    .eq("id", clubId)
    .maybeSingle();
  return resolveCancellationHours((club as { cancellation_hours?: number | null } | null)?.cancellation_hours);
}

/**
 * ¿La cancelación de este partido abierto cae dentro de la ventana penalizada?
 *
 * Devuelve `false` para todo partido que nunca llegó a confirmarse: crear un
 * partido y no completarlo no compromete la cancha, así que no puede generar
 * obligación por más cerca del horario que esté.
 */
export async function isOpenMatchCancellationLate(
  supabase: SupabaseClient,
  match: {
    courtId: string;
    scheduledDate: string;
    scheduledTime: string;
    confirmedAt: string | null;
    matchStatus?: string | null;
  }
): Promise<boolean> {
  if (!isBookingConfirmed({ confirmed_at: match.confirmedAt, match_status: match.matchStatus })) {
    return false;
  }
  if (!match.scheduledDate || !match.scheduledTime) return false;
  const hours = await resolveClubCancellationHours(supabase, match.courtId);
  const startMs = utcMsForArgentinaWallClock(match.scheduledDate, match.scheduledTime);
  if (!Number.isFinite(startMs)) return false;
  return isLateCancellation((startMs - Date.now()) / 60_000, hours);
}
