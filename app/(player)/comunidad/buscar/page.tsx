import Link from "next/link";
import { redirect } from "next/navigation";
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
    .select("user_id, name, avatar_url, level, level_of_play, technical_score")
    .neq("user_id", user.id)
    .order("name", { ascending: true })
    .limit(48);

  const list = (rows ?? []) as {
    user_id: string;
    name: string | null;
    avatar_url: string | null;
    level?: number | null;
    level_of_play?: string | null;
    technical_score?: number | null;
  }[];

  const { data: favoritesRows } = await supabase
    .from(DB_TABLES.userFavorites)
    .select("favorite_user_id")
    .eq("user_id", user.id);
  const favoriteIds = (favoritesRows ?? []).map((f: { favorite_user_id: string }) => f.favorite_user_id);

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-slate-50 px-4 pb-32 pt-6">
      <Link
        href="/comunidad"
        className="inline-block text-sm font-semibold text-sky-600 hover:text-sky-700"
      >
        ← Comunidad
      </Link>

      <FriendsSearchClient currentUserId={user.id} players={list} initialFriendIds={favoriteIds} />
    </MotionPage>
  );
}
