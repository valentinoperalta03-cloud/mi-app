import Link from "next/link";
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

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-slate-50 px-4 pb-32 pt-6">
      <Link
        href="/comunidad"
        className="inline-block text-sm font-semibold text-[#0585FC] hover:text-[#0461C4]"
      >
        ← Comunidad
      </Link>

      {list.length === 0 ? (
        <EmptyStateCard
          icon="users"
          title="No encontramos jugadores"
          subtitle="Probá con otro nombre o esperá que más jugadores se sumen"
        />
      ) : (
        <FriendsSearchClient currentUserId={user.id} players={list} />
      )}
    </MotionPage>
  );
}
