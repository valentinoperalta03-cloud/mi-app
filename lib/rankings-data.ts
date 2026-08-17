import { DB_TABLES } from "@/lib/db-tables";
import { formatPlayerCategory } from "@/lib/profile-display";
import { getAdminClient } from "@/utils/supabase/server";

export type TopMatchesRow = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  matches_played: number;
  categoryLabel: string;
};

export type RankingsPreview = {
  myGlobalPosition: number | null;
  totalRankedPlayers: number;
  weeklyFirstName: string | null;
};

export async function fetchTopByMatchesPlayed(limit = 10): Promise<TopMatchesRow[]> {
  const admin = await getAdminClient();
  const { data, error } = await admin
    .from(DB_TABLES.matchParticipants)
    .select("player_id")
    .not("player_id", "is", null);

  if (error || !data?.length) return [];

  const countMap = new Map<string, number>();
  for (const row of data as { player_id: string }[]) {
    countMap.set(row.player_id, (countMap.get(row.player_id) ?? 0) + 1);
  }

  const sorted = [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (!sorted.length) return [];

  const ids = sorted.map(([id]) => id);
  const { data: profiles } = await admin
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url, category")
    .in("user_id", ids);

  const byId = new Map(
    (profiles ?? []).map(
      (p: {
        user_id: string;
        name: string | null;
        avatar_url: string | null;
        category: string | null;
      }) => [p.user_id, p]
    )
  );

  return sorted.map(([user_id, matches_played]) => {
    const p = byId.get(user_id) as
      | { name: string | null; avatar_url: string | null; category: string | null }
      | undefined;
    return {
      user_id,
      matches_played,
      name: p?.name ?? null,
      avatar_url: p?.avatar_url ?? null,
      categoryLabel: formatPlayerCategory(p?.category ?? null),
    };
  });
}

export async function fetchRankingsPreview(_userId: string): Promise<RankingsPreview> {
  return {
    myGlobalPosition: null,
    totalRankedPlayers: 0,
    weeklyFirstName: null,
  };
}
