import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

export type PostProfile = {
  name: string | null;
  avatar_url: string | null;
};

export type PostFeedItem = {
  id: string;
  content: string;
  match_id: string | null;
  created_at: string;
  user_id: string;
  image_url: string | null;
  post_type: "text" | "photo" | "result";
  profiles: PostProfile | null;
  scoreLabel: string | null;
};

export async function fetchPostsFeed(
  supabase: SupabaseClient
): Promise<PostFeedItem[]> {
  const { data: posts, error } = await supabase
    .from(DB_TABLES.posts)
    .select("id, content, match_id, created_at, user_id, image_url, post_type")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !posts?.length) {
    return [];
  }

  const userIds = [...new Set(posts.map((p) => p.user_id))];
  const { data: profs } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url")
    .in("user_id", userIds);

  const profileMap = new Map(
    (profs ?? []).map(
      (p: { user_id: string; name: string | null; avatar_url: string | null }) => [
        p.user_id,
        { name: p.name, avatar_url: p.avatar_url } satisfies PostProfile,
      ]
    )
  );

  const matchIds = [
    ...new Set(posts.map((p) => p.match_id).filter((id): id is string => Boolean(id))),
  ];

  const scores: Record<string, string> = {};
  if (matchIds.length > 0) {
    const { data: mr } = await supabase
      .from(DB_TABLES.matchResults)
      .select("match_id, team_a_score, team_b_score")
      .in("match_id", matchIds);

    for (const r of mr ?? []) {
      const row = r as {
        match_id: string;
        team_a_score: number | null;
        team_b_score: number | null;
      };
      if (row.team_a_score != null && row.team_b_score != null) {
        scores[row.match_id] = `${row.team_a_score} — ${row.team_b_score}`;
      }
    }
  }

  return posts.map((p) => ({
    id: p.id,
    content: p.content,
    match_id: p.match_id,
    created_at: p.created_at,
    user_id: p.user_id,
    image_url: p.image_url ?? null,
    post_type: (p.post_type ?? "text") as "text" | "photo" | "result",
    profiles: profileMap.get(p.user_id) ?? null,
    scoreLabel: p.match_id ? (scores[p.match_id] ?? null) : null,
  }));
}

export type LatestMatchLink = {
  match_id: string;
  scoreLabel: string;
} | null;

/** Último partido con resultado registrado donde participó el usuario (para vincular al post). */
export async function fetchLatestMatchResultForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<LatestMatchLink> {
  const { data: participation } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("player_id", userId);

  const ids = [...new Set((participation ?? []).map((r: { match_id: string }) => r.match_id))];
  if (ids.length === 0) return null;

  const { data: results } = await supabase
    .from(DB_TABLES.matchResults)
    .select("match_id, team_a_score, team_b_score, created_at")
    .in("match_id", ids)
    .order("created_at", { ascending: false })
    .limit(1);

  const row = results?.[0] as
    | {
        match_id: string;
        team_a_score: number | null;
        team_b_score: number | null;
      }
    | undefined;

  if (!row) return null;
  if (row.team_a_score == null || row.team_b_score == null) {
    return { match_id: row.match_id, scoreLabel: "Resultado registrado" };
  }
  return {
    match_id: row.match_id,
    scoreLabel: `${row.team_a_score} — ${row.team_b_score}`,
  };
}
