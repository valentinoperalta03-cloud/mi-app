import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";

type CourtClubRel = { clubs: { owner_id: string | null } | { owner_id: string | null }[] | null };

/**
 * Aviso de partido abierto completo (4 jugadores). Un solo aviso por usuario: el
 * organizador puede ser también participante o, si lo abrió el club, el dueño del club.
 */
export async function notifyOpenMatchConfirmed(supabase: SupabaseClient, matchId: string): Promise<void> {
  const [{ data: participantRows }, { data: matchRow }] = await Promise.all([
    supabase.from(DB_TABLES.matchParticipants).select("player_id").eq("match_id", matchId),
    supabase.from(DB_TABLES.matches).select("owner_id, courts(clubs(owner_id))").eq("id", matchId).maybeSingle(),
  ]);

  const match = matchRow as { owner_id: string | null; courts: CourtClubRel | CourtClubRel[] | null } | null;
  const court = Array.isArray(match?.courts) ? match?.courts[0] ?? null : match?.courts ?? null;
  const club = Array.isArray(court?.clubs) ? court?.clubs[0] ?? null : court?.clubs ?? null;
  const clubOwnerId = String(club?.owner_id ?? "").trim();

  const playerIds = new Set<string>();
  for (const row of (participantRows ?? []) as Array<{ player_id: string | null }>) {
    if (row.player_id) playerIds.add(row.player_id);
  }
  if (match?.owner_id) playerIds.add(match.owner_id);

  for (const userId of playerIds) {
    await createNotification(supabase, {
      user_id: userId,
      type: "player_joined",
      title: "¡Partido confirmado!",
      body: "Ya están los 4 jugadores para tu partido.",
      match_id: matchId,
    });
  }

  if (clubOwnerId && !playerIds.has(clubOwnerId)) {
    await createNotification(supabase, {
      user_id: clubOwnerId,
      type: "club_agenda",
      title: "Partido abierto confirmado",
      body: "Se completaron los 4 jugadores. El cobro del partido se hace en el club.",
      match_id: matchId,
    });
  }
}
