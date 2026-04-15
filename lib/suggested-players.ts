import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

export type SuggestedPlayer = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  level_of_play: string | null;
  technical_score?: number | null;
};

/**
 * Jugadores de un tramo similar de nivel (mismo entero en escala 0–7 o mismo `level_of_play` legacy).
 */
export async function fetchSuggestedPlayers(
  supabase: SupabaseClient,
  userId: string
): Promise<SuggestedPlayer[]> {
  const { data: me } = await supabase
    .from(DB_TABLES.profiles)
    .select("level_of_play, technical_score")
    .eq("user_id", userId)
    .maybeSingle();

  const row = me as { level_of_play?: string | null; technical_score?: number | null } | null;
  const tech = row?.technical_score != null ? Number(row.technical_score) : NaN;
  const legacyBand = row?.level_of_play?.trim() ?? "";

  const { data: favs } = await supabase
    .from(DB_TABLES.userFavorites)
    .select("favorite_user_id")
    .eq("user_id", userId);

  const favIds = new Set(
    (favs ?? []).map((f: { favorite_user_id: string }) => f.favorite_user_id)
  );

  let query = supabase
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url, level_of_play, technical_score")
    .neq("user_id", userId)
    .limit(48);

  if (Number.isFinite(tech)) {
    const lo = Math.floor(tech);
    const hi = lo + 1;
    query = query.gte("technical_score", lo).lt("technical_score", hi);
  } else if (legacyBand) {
    query = query.eq("level_of_play", legacyBand);
  } else {
    return [];
  }

  const { data: rows, error } = await query;

  if (error || !rows?.length) return [];

  return (rows as SuggestedPlayer[]).filter((r) => !favIds.has(r.user_id)).slice(0, 24);
}
