import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { HomeSuggestionsSection } from "@/components/home-suggestions-section";
import { HomeSuggestionsSkeleton } from "@/components/home-loading-skeletons";
import {
  fetchLatestMatchResultForUser,
  fetchPostsFeed,
} from "@/lib/para-ti-posts";
import { fetchRankingsPreview } from "@/lib/rankings-data";
import { createClient } from "@/utils/supabase/server";
import { ComunidadClient } from "./comunidad-client";

type ComunidadPageProps = {
  searchParams?: Promise<{ tab?: string | string[] }>;
};

export default async function ComunidadPage({ searchParams }: ComunidadPageProps) {
  const sp = searchParams ? await searchParams : {};
  const raw = sp.tab;
  const tabParam = Array.isArray(raw) ? raw[0] : raw;
  const activeTab = tabParam === "jugadores" ? "jugadores" : "para-ti";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [posts, latestMatch, rankingsPreview] = await Promise.all([
    fetchPostsFeed(supabase),
    fetchLatestMatchResultForUser(supabase, user.id),
    fetchRankingsPreview(user.id),
  ]);
  const { data: rows } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url, bio, category, level, level_of_play, technical_score")
    .neq("user_id", user.id)
    .order("name", { ascending: true })
    .limit(300);

  const players = (rows ?? []) as {
    user_id: string;
    name: string | null;
    avatar_url: string | null;
    bio?: string | null;
    category?: string | null;
    level?: number | null;
    level_of_play?: string | null;
    technical_score?: number | null;
  }[];
  const playerIds = players.map((p) => p.user_id);

  const [myFollowingRes, followsMeRes] = await Promise.all([
    playerIds.length
      ? supabase
          .from(DB_TABLES.userFavorites)
          .select("favorite_id")
          .eq("user_id", user.id)
          .in("favorite_id", playerIds)
      : Promise.resolve({ data: [] as { favorite_id: string }[] }),
    playerIds.length
      ? supabase
          .from(DB_TABLES.userFavorites)
          .select("user_id")
          .eq("favorite_id", user.id)
          .in("user_id", playerIds)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);

  const initialFollowingIds = ((myFollowingRes.data ?? []) as { favorite_id: string }[]).map(
    (row) => row.favorite_id
  );
  const followsMeIds = ((followsMeRes.data ?? []) as { user_id: string }[]).map(
    (row) => row.user_id
  );

  const suggestions =
    activeTab === "para-ti" ? (
      <section className="min-w-0 space-y-3">
        <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">Sugerencias para vos</h2>
        <Suspense fallback={<HomeSuggestionsSkeleton />}>
          <HomeSuggestionsSection userId={user.id} />
        </Suspense>
      </section>
    ) : null;

  return (
    <ComunidadClient
      activeTab={activeTab}
      posts={posts}
      latestMatch={latestMatch}
      players={players}
      initialFollowingIds={initialFollowingIds}
      followsMeIds={followsMeIds}
      userId={user.id}
      rankingsPreview={rankingsPreview}
    >
      {suggestions}
    </ComunidadClient>
  );
}
