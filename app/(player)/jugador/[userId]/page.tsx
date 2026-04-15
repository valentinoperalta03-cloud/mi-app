import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { ProfileAvatar } from "@/components/profile-avatar";
import { FavoritePlayerButton } from "@/components/favorite-player-button";
import { DB_TABLES } from "@/lib/db-tables";
import { formatProfileNivelFromRow, splitOfficialCategoryLine } from "@/lib/profile-display";
import { createClient } from "@/utils/supabase/server";

type PageProps = { params: Promise<{ userId: string }> };

export default async function JugadorPublicProfilePage({ params }: PageProps) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id === userId) {
    redirect("/perfil");
  }

  const { data: profile, error } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, name, level, level_of_play, technical_score, age, bio, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) {
    notFound();
  }

  const row = profile as {
    name: string | null;
    level?: number | null;
    level_of_play?: string | null;
    technical_score?: number | null;
    age: number | null;
    bio: string | null;
    avatar_url: string | null;
  };

  const displayName = row.name?.trim() || "Jugador";

  let favorited = false;
  if (user) {
    const { data: favRow } = await supabase
      .from(DB_TABLES.userFavorites)
      .select("user_id")
      .eq("user_id", user.id)
      .eq("favorite_user_id", userId)
      .maybeSingle();
    favorited = Boolean(favRow);
  }
  const nivelLine = formatProfileNivelFromRow(row);
  const nivelParts = splitOfficialCategoryLine(nivelLine);

  return (
    <MotionPage className="relative mx-auto min-h-screen w-full max-w-md bg-gradient-to-b from-slate-50 to-white px-4 pb-32 pt-6">
      <Link
        href="/home"
        className="mb-4 inline-block text-sm font-semibold text-slate-600 transition hover:text-sky-600"
      >
        ← Volver
      </Link>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 text-center shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
        <div className="mx-auto w-fit">
          <ProfileAvatar avatarUrl={row.avatar_url} name={displayName} size={96} />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">{displayName}</h1>
        <p className="mt-2 text-sm text-sky-700">
          <span className="font-bold">{nivelParts.category || "—"}</span>
          {nivelParts.description ? (
            <span className="font-medium text-sky-700">{" - "}{nivelParts.description}</span>
          ) : null}
        </p>
      </section>

      {(row.age != null && row.age > 0) || row.bio?.trim() ? (
        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Sobre el jugador</h2>
          {row.age != null && row.age > 0 ? (
            <p className="rounded-3xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-700 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
              <span className="font-semibold text-slate-900">Edad:</span> {row.age} años
            </p>
          ) : null}
          {row.bio?.trim() ? (
            <p className="rounded-3xl border border-slate-200/80 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
              {row.bio.trim()}
            </p>
          ) : null}
        </section>
      ) : null}

      {user ? (
        <div className="fixed bottom-24 right-5 z-40">
          <FavoritePlayerButton targetUserId={userId} initialFavorited={favorited} />
        </div>
      ) : null}
    </MotionPage>
  );
}
