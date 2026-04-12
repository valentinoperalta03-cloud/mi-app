import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

export type SuggestedPlayer = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  category: string | null;
  level: string | number | null;
};

/**
 * Jugadores con la misma categoría que el usuario, excluyendo al propio usuario y a favoritos.
 */
export async function fetchSuggestedPlayers(
  supabase: SupabaseClient,
  userId: string
): Promise<SuggestedPlayer[]> {
  const { data: me } = await supabase
    .from(DB_TABLES.profiles)
    .select("category")
    .eq("user_id", userId)
    .maybeSingle();

  const category = (me as { category?: string | null } | null)?.category?.trim();
  if (!category) return [];

  const { data: favs } = await supabase
    .from(DB_TABLES.userFavorites)
    .select("favorite_user_id")
    .eq("user_id", userId);

  const favIds = new Set(
    (favs ?? []).map((f: { favorite_user_id: string }) => f.favorite_user_id)
  );

  const { data: rows, error } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url, category, level")
    .eq("category", category)
    .neq("user_id", userId)
    .limit(24);

  if (error || !rows?.length) return [];

  return (rows as SuggestedPlayer[]).filter((r) => !favIds.has(r.user_id));
}
