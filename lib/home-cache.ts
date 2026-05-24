import { unstable_cache } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export type PendingResultForHome = {
  match_id: string;
  team_a_score: number | null;
  team_b_score: number | null;
  proposed_by?: string | null;
  status?: string | null;
};

async function fetchProfileDisplayName(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from(DB_TABLES.profiles)
    .select("name")
    .eq("user_id", userId)
    .maybeSingle();

  return (profile as { name?: string | null } | null)?.name?.trim() || "Jugador";
}

async function fetchPendingResultsForUser(userId: string): Promise<PendingResultForHome[]> {
  const supabase = await createClient();
  const { data: pendingRows } = await supabase
    .from(DB_TABLES.matchResults)
    .select("match_id, team_a_score, team_b_score, proposed_by, status")
    .eq("status", "pending_confirmation");

  const pending = (pendingRows ?? []) as PendingResultForHome[];
  if (pending.length === 0) return [];

  const matchIds = pending.map((r) => r.match_id);
  const { data: myParticipations } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id, player_id")
    .eq("player_id", userId)
    .in("match_id", matchIds);

  const mine = new Set((myParticipations ?? []).map((r: { match_id: string }) => r.match_id));
  return pending.filter((r) => mine.has(r.match_id) && r.proposed_by !== userId);
}

export function getCachedProfileDisplayName(userId: string) {
  return unstable_cache(
    async () => fetchProfileDisplayName(userId),
    ["home-profile-name", userId],
    { revalidate: 60, tags: [`home-profile-${userId}`] }
  )();
}

export function getCachedPendingResultsForUser(userId: string) {
  return unstable_cache(
    async () => fetchPendingResultsForUser(userId),
    ["home-pending-results", userId],
    { revalidate: 30, tags: [`home-pending-${userId}`] }
  )();
}

/** Precalienta datos del home (perfil + resultados pendientes) en caché de Next.js. */
export async function warmupHomeData(userId: string) {
  await Promise.all([
    getCachedProfileDisplayName(userId),
    getCachedPendingResultsForUser(userId),
  ]);
}
