import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

export type ComunidadPlayerRow = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  category?: string | null;
  level?: number | null;
  level_of_play?: string | null;
  technical_score?: number | null;
};

export async function fetchComunidadPlayersData(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  players: ComunidadPlayerRow[];
  initialFollowingIds: string[];
  followsMeIds: string[];
}> {
  const { data: rows } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url, bio, category, level, level_of_play, technical_score")
    .neq("user_id", userId)
    .order("name", { ascending: true })
    .limit(300);

  const players = (rows ?? []) as ComunidadPlayerRow[];
  const playerIds = players.map((p) => p.user_id);

  const [myFollowingRes, followsMeRes] = await Promise.all([
    playerIds.length
      ? supabase
          .from(DB_TABLES.userFavorites)
          .select("favorite_id")
          .eq("user_id", userId)
          .in("favorite_id", playerIds)
      : Promise.resolve({ data: [] as { favorite_id: string }[] }),
    playerIds.length
      ? supabase
          .from(DB_TABLES.userFavorites)
          .select("user_id")
          .eq("favorite_id", userId)
          .in("user_id", playerIds)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);

  return {
    players,
    initialFollowingIds: ((myFollowingRes.data ?? []) as { favorite_id: string }[]).map(
      (row) => row.favorite_id
    ),
    followsMeIds: ((followsMeRes.data ?? []) as { user_id: string }[]).map((row) => row.user_id),
  };
}
