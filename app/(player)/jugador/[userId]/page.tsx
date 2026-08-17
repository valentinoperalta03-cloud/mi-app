import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, MapPin } from "lucide-react";
import MotionPage from "@/components/motion-page";
import { ProfileAvatar } from "@/components/profile-avatar";
import { DB_TABLES } from "@/lib/db-tables";
import { formatPlayerCategory } from "@/lib/profile-display";
import { createClient } from "@/utils/supabase/server";
import ProfileSocialActions from "@/components/profile-social-actions";

type PageProps = { params: Promise<{ userId: string }> };

export default async function JugadorPublicProfilePage({ params }: PageProps) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isMe = user?.id === userId;

  const { data: profile, error } = await supabase
    .from(DB_TABLES.profiles)
    .select(
      "user_id, name, gender, category, age, bio, avatar_url, preferred_hand, court_position, preferred_schedule, city, province"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) {
    notFound();
  }

  const row = profile as {
    name: string | null;
    gender?: "masculino" | "femenino" | null;
    category?: string | null;
    age: number | null;
    bio: string | null;
    avatar_url: string | null;
    preferred_hand?: string | null;
    court_position?: string | null;
    preferred_schedule?: string | null;
    city?: string | null;
    province?: string | null;
  };

  const displayName = row.name?.trim() || "Jugador";
  const cityProvince = [row.city, row.province]
    .filter((v): v is string => Boolean(v?.trim()))
    .map((v) => v.trim())
    .join(", ");

  let favorited = false;
  let followsBack = false;
  let isMutual = false;
  if (user && !isMe) {
    const [{ data: favRow }, { data: followsBackRow }] = await Promise.all([
      supabase
        .from(DB_TABLES.userFavorites)
        .select("user_id")
        .eq("user_id", user.id)
        .eq("favorite_user_id", userId)
        .maybeSingle(),
      supabase
        .from(DB_TABLES.userFavorites)
        .select("user_id")
        .eq("user_id", userId)
        .eq("favorite_user_id", user.id)
        .maybeSingle(),
    ]);
    favorited = Boolean(favRow);
    followsBack = Boolean(followsBackRow);
    isMutual = favorited && followsBack;
  }
  const categoryLabel = formatPlayerCategory(row.category);

  const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
    supabase
      .from(DB_TABLES.userFavorites)
      .select("favorite_user_id", { count: "exact", head: true })
      .eq("favorite_user_id", userId),
    supabase
      .from(DB_TABLES.userFavorites)
      .select("favorite_user_id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const { data: participantRows } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("player_id", userId)
    .limit(500);
  const matchIds = [...new Set((participantRows ?? []).map((r: { match_id: string }) => r.match_id))];
  const partidosJugados = matchIds.length;

  const { data: participantsInMyMatches } = matchIds.length
    ? await supabase
        .from(DB_TABLES.matchParticipants)
        .select("player_id, match_id")
        .in("match_id", matchIds.slice(0, 300))
    : { data: [] };

  const coPlayerCounter = new Map<string, number>();
  for (const row of (participantsInMyMatches ?? []) as Array<{ player_id: string; match_id: string }>) {
    if (row.player_id === userId) continue;
    coPlayerCounter.set(row.player_id, (coPlayerCounter.get(row.player_id) ?? 0) + 1);
  }
  const topCoPlayerIds = [...coPlayerCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  const { data: topCoPlayers } = topCoPlayerIds.length
    ? await supabase
        .from(DB_TABLES.profiles)
        .select("user_id, name")
        .in("user_id", topCoPlayerIds)
    : { data: [] };
  const topCoPlayerMap = new Map(
    (topCoPlayers ?? []).map((p: { user_id: string; name: string | null }) => [p.user_id, p.name?.trim() || "Jugador"])
  );
  const topCoPlayersWithCount = topCoPlayerIds.map((id) => ({
    id,
    name: topCoPlayerMap.get(id) ?? "Jugador",
    count: coPlayerCounter.get(id) ?? 0,
  }));

  const { data: matchesRows } = matchIds.length
    ? await supabase
        .from(DB_TABLES.matches)
        .select("id, court_id")
        .in("id", matchIds.slice(0, 300))
    : { data: [] };
  const courtIds = [...new Set((matchesRows ?? []).map((m: { court_id: string | null }) => m.court_id).filter(Boolean))] as string[];
  const { data: courtsRows } = courtIds.length
    ? await supabase.from(DB_TABLES.courts).select("id, club_id").in("id", courtIds)
    : { data: [] };
  const clubIds = [...new Set((courtsRows ?? []).map((c: { club_id: string | null }) => c.club_id).filter(Boolean))] as string[];
  const { data: clubsRows } = clubIds.length
    ? await supabase.from(DB_TABLES.clubs).select("id, name").in("id", clubIds)
    : { data: [] };
  const clubMap = new Map((clubsRows ?? []).map((c: { id: string; name: string | null }) => [c.id, c.name?.trim() || "Club"]));
  const clubCounter = new Map<string, number>();
  for (const court of (courtsRows ?? []) as Array<{ id: string; club_id: string | null }>) {
    if (!court.club_id) continue;
    clubCounter.set(court.club_id, (clubCounter.get(court.club_id) ?? 0) + 1);
  }
  const topClubs = [...clubCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([clubId, count]) => ({ clubId, count, name: clubMap.get(clubId) ?? "Club" }));

  return (
    <MotionPage className="relative mx-auto min-h-screen w-full max-w-md bg-[var(--bg-app)] px-4 pb-32 pt-6">
      <Link
        href="/home"
        className="mb-4 inline-block text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[#0085FC]"
      >
        ← Volver
      </Link>

      <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto w-fit">
          <ProfileAvatar avatarUrl={row.avatar_url} name={displayName} size={96} />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-[var(--text-primary)]">{displayName}</h1>
        {cityProvince ? (
          <p className="mt-1 flex items-center justify-center gap-1 text-sm text-[var(--text-tertiary)]">
            <MapPin size={14} className="shrink-0" aria-hidden />
            {cityProvince}
          </p>
        ) : null}
        <span
          className="mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest"
          style={{ background: "#CCFF00", color: "#000" }}
        >
          {categoryLabel}
        </span>
        {!isMe && isMutual ? (
          <span className="mt-2 ml-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Amigos ✓
          </span>
        ) : null}
        {!isMe && user ? (
          <div className="mt-4">
            <ProfileSocialActions
              targetUserId={userId}
              initialFollowing={favorited}
              followsBack={followsBack}
              initialIsMutual={isMutual}
              isMe={isMe}
            />
          </div>
        ) : null}
        {row.bio?.trim() ? (
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{row.bio.trim()}</p>
        ) : null}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Partidos</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{partidosJugados}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Seguidores</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{followersCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Siguiendo</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{followingCount ?? 0}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">Preferencias del jugador</h2>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-3 text-center shadow-[var(--shadow-card)]">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Mano</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{row.preferred_hand || "—"}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-3 text-center shadow-[var(--shadow-card)]">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Posición</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{row.court_position || "—"}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-3 text-center shadow-[var(--shadow-card)]">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Horario</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{row.preferred_schedule || "—"}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
          Jugadores con quien más juega
        </h2>
        {topCoPlayersWithCount.length === 0 ? (
          <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-tertiary)] shadow-[var(--shadow-card)]">
            {displayName} todavía no tiene suficientes partidos para calcular compañeros frecuentes.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {topCoPlayersWithCount.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/jugador/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-sm shadow-[var(--shadow-card)] transition hover:bg-[var(--bg-subtle)]"
                >
                  <span className="truncate font-medium text-[var(--text-primary)]">{p.name}</span>
                  <span className="shrink-0 rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]">
                    {p.count} partido{p.count === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">Clubes donde juega</h2>
        {topClubs.length === 0 ? (
          <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-tertiary)] shadow-[var(--shadow-card)]">
            Todavía no hay clubes suficientes para mostrar.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {topClubs.map((club) => (
              <li key={club.clubId}>
                <Link
                  href={`/clubes/${club.clubId}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-sm shadow-[var(--shadow-card)] transition hover:bg-[var(--bg-subtle)]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-[#0085FC]" strokeWidth={1.6} />
                    <span className="truncate font-medium text-[var(--text-primary)]">{club.name}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]">
                    {club.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isMe ? (
        <div className="mt-6">
          <Link
            href="/perfil/editar"
            className="block rounded-2xl bg-[color:var(--color-brand-mid)] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[color:var(--color-brand-light)] active:scale-[0.98]"
          >
            Editar mi perfil
          </Link>
        </div>
      ) : null}
    </MotionPage>
  );
}
