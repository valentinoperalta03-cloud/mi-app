import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

/** Elige equipo 1 o 2 con cupo libre (máx. 2 por equipo). */
export async function pickTeamForMatch(client: SupabaseClient, matchId: string): Promise<1 | 2 | null> {
  const { data, error } = await client.from(DB_TABLES.matchParticipants).select("team").eq("match_id", matchId);
  if (error) return null;
  const rows = (data ?? []) as { team: number | null }[];
  const c1 = rows.filter((r) => r.team === 1).length;
  const c2 = rows.filter((r) => r.team === 2).length;
  if (c1 < 2) return 1;
  if (c2 < 2) return 2;
  return null;
}
