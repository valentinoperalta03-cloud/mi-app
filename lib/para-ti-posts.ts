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

  return posts.map((p) => ({
    id: p.id,
    content: p.content,
    match_id: p.match_id,
    created_at: p.created_at,
    user_id: p.user_id,
    image_url: p.image_url ?? null,
    post_type: (p.post_type ?? "text") as "text" | "photo" | "result",
    profiles: profileMap.get(p.user_id) ?? null,
    scoreLabel: null,
  }));
}

export type LatestMatchLink = {
  match_id: string;
  scoreLabel: string;
} | null;

/** Ya no hay flujo de carga de resultados: nunca hay un partido para vincular. */
export async function fetchLatestMatchResultForUser(
  _supabase: SupabaseClient,
  _userId: string
): Promise<LatestMatchLink> {
  return null;
}
