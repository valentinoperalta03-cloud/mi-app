import { redirect } from "next/navigation";
import EmptyStateCard from "@/components/empty-state-card";
import MotionPage from "@/components/motion-page";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import FriendsSearchClient from "./friends-search-client";

export default async function ComunidadBuscarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url, bio, category, level, level_of_play, technical_score")
    .neq("user_id", user.id)
    .order("name", { ascending: true })
    .limit(300);

  const list = (rows ?? []) as {
    user_id: string;
    name: string | null;
    avatar_url: string | null;
    bio?: string | null;
    category?: string | null;
    level?: number | null;
    level_of_play?: string | null;
    technical_score?: number | null;
  }[];
  const playerIds = list.map((p) => p.user_id);

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

  const initialFollowingIds = new Set(
    ((myFollowingRes.data ?? []) as { favorite_id: string }[]).map((row) => row.favorite_id)
  );
  const followsMeIds = new Set(
    ((followsMeRes.data ?? []) as { user_id: string }[]).map((row) => row.user_id)
  );

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-[var(--bg-app)] px-4 pb-32 pt-6">
      {list.length === 0 ? (
        <EmptyStateCard
          icon="users"
          title="No encontramos jugadores"
          subtitle="Probá con otro nombre o esperá que más jugadores se sumen"
        />
      ) : (
        <FriendsSearchClient
          players={list}
          initialFollowingIds={[...initialFollowingIds]}
          followsMeIds={[...followsMeIds]}
        />
      )}
    </MotionPage>
  );
}
