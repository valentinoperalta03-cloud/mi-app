import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Star, Trophy } from "lucide-react";
import MotionPage from "@/components/motion-page";
import { ProfileAvatar } from "@/components/profile-avatar";
import { FavoritePlayerButton } from "@/components/favorite-player-button";
import { DB_TABLES } from "@/lib/db-tables";
import { formatProfileNivel } from "@/lib/profile-display";
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
    .select("user_id, name, category, level, matches_played, wins, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) {
    notFound();
  }

  const row = profile as {
    name: string | null;
    category: string | null;
    level: string | number | null;
    matches_played: number | null;
    wins: number | null;
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
  const matchesPlayed = row.matches_played ?? 0;
  const wins = row.wins ?? 0;
  const nivelLine = formatProfileNivel(row.category, row.level);

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
        <p className="mt-2 text-sm font-medium text-slate-600">{nivelLine}</p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Resumen</h2>
        <article className="flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white px-4 py-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
            <Trophy size={20} strokeWidth={2.1} aria-hidden />
          </span>
          <div>
            <p className="text-2xl font-bold tabular-nums text-slate-900">{matchesPlayed}</p>
            <p className="text-xs font-semibold text-slate-500">Partidos</p>
          </div>
        </article>
        <article className="flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white px-4 py-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Star size={20} strokeWidth={2.1} aria-hidden />
          </span>
          <div>
            <p className="text-2xl font-bold tabular-nums text-slate-900">{wins}</p>
            <p className="text-xs font-semibold text-slate-500">Victorias</p>
          </div>
        </article>
      </section>

      {user ? (
        <div className="fixed bottom-24 right-5 z-40">
          <FavoritePlayerButton targetUserId={userId} initialFavorited={favorited} />
        </div>
      ) : null}
    </MotionPage>
  );
}
