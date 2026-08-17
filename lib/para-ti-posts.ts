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

export type MatchFeedItem = {
  id: string;
  type: "match";
  clubName: string;
  courtName: string | null;
  scheduledDate: string;
  scheduledTime: string;
  genderCategory: "masculino" | "femenino" | "mixto";
  categoryRange: string[] | null;
  playersCount: number;
  freeSlots: number;
  created_at: string;
};

export type FeedItem = (PostFeedItem & { type: "post" }) | MatchFeedItem;

export async function fetchFeedWithMatches(
  supabase: SupabaseClient,
  userCity: string
): Promise<FeedItem[]> {
  const posts = await fetchPostsFeed(supabase);
  const postsWithType: FeedItem[] = posts.map((p) => ({ ...p, type: "post" as const }));

  const nowIso = new Date().toISOString();
  const { data: matchRows } = await supabase
    .from(DB_TABLES.matches)
    .select(
      `
      id, date, scheduled_date, scheduled_time,
      gender_category, category_range,
      courts(name, clubs(name, city))
    `
    )
    .eq("match_type", "amistoso")
    .neq("match_status", "cancelled")
    .gt("date", nowIso)
    .order("date", { ascending: true })
    .limit(20);

  const matchIds = (matchRows ?? []).map((m: any) => m.id);
  const { data: participantRows } = matchIds.length
    ? await supabase
        .from(DB_TABLES.matchParticipants)
        .select("match_id, player_id")
        .in("match_id", matchIds)
    : { data: [] };

  const participantCounts = new Map<string, number>();
  for (const p of (participantRows ?? []) as any[]) {
    participantCounts.set(p.match_id, (participantCounts.get(p.match_id) ?? 0) + 1);
  }

  const matches: MatchFeedItem[] = ((matchRows ?? []) as any[])
    .filter((m) => {
      const courtRel = Array.isArray(m.courts) ? m.courts[0] : m.courts;
      const clubRel = Array.isArray(courtRel?.clubs) ? courtRel.clubs[0] : courtRel?.clubs;
      if (!userCity) return true;
      const clubCity = (clubRel?.city ?? "").trim().toLowerCase();
      return clubCity === userCity.trim().toLowerCase();
    })
    .map((m) => {
      const courtRel = Array.isArray(m.courts) ? m.courts[0] : m.courts;
      const clubRel = Array.isArray(courtRel?.clubs) ? courtRel.clubs[0] : courtRel?.clubs;
      const playersCount = participantCounts.get(m.id) ?? 0;
      return {
        id: m.id,
        type: "match" as const,
        clubName: clubRel?.name ?? "Club",
        courtName: courtRel?.name ?? null,
        scheduledDate: m.scheduled_date ?? "",
        scheduledTime: String(m.scheduled_time ?? "").slice(0, 5),
        genderCategory: m.gender_category ?? "mixto",
        categoryRange: m.category_range ?? null,
        playersCount,
        freeSlots: Math.max(0, 4 - playersCount),
        created_at: m.date,
      };
    });

  const combined: FeedItem[] = [...postsWithType, ...matches];
  combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return combined;
}
