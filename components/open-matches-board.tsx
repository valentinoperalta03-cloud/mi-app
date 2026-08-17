import EmptyStateCard from "@/components/empty-state-card";
import { BuscarPartidoInfoButton } from "@/components/buscar-partido-info-button";
import MatchesFilterBoard, { type MatchCardData } from "@/components/matches-filter-board";
import MotionPage from "@/components/motion-page";
import { PlayerStackHeader } from "@/components/player-back-button";
import { DB_TABLES } from "@/lib/db-tables";
import { isMatchPrivate } from "@/lib/match-visibility";
import { formatCityLabel, normalizeCity } from "@/lib/locations";
import { getUserLocationServer } from "@/lib/locations-server";
import { createClient } from "@/utils/supabase/server";

type MatchFeedRow = {
  id: string;
  date: string;
  owner_id?: string | null;
  visibility?: "publico" | "privado" | string | null;
  total_price?: number | null;
  level_restricted?: boolean | null;
  gender_category?: "masculino" | "femenino" | "mixto" | null;
  category_range?: string[] | null;
  courts:
    | {
        clubs:
          | {
              name: string | null;
              location: string | null;
              city?: string | null;
              province?: string | null;
            }
          | null;
      }
    | null;
  match_participants:
    | {
        player_id: string;
        team?: number | null;
        profiles:
          | {
              name: string | null;
              avatar_url: string | null;
            }
          | null;
      }[]
    | null;
};

type OpenMatchesBoardProps = {
  searchParams?: Promise<{
    message?: string;
    kind?: string;
  }>;
  kicker?: string;
  title: string;
  description: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyCtaLabel?: string;
  emptyCtaHref?: string;
  mobileFirst?: boolean;
  backHref?: string;
  backLabel?: string;
};

export default async function OpenMatchesBoard({
  searchParams,
  kicker = "Partidos",
  title,
  description,
  emptyTitle = "Nadie armó partido para hoy todavía",
  emptySubtitle = "Dale movimiento a la comunidad y crea un partido para que otros jugadores se sumen.",
  emptyCtaLabel = "Armar el primer partido",
  emptyCtaHref = "/crear-partido",
  mobileFirst = false,
  backHref,
  backLabel = "Volver al inicio",
}: OpenMatchesBoardProps) {
  const supabase = await createClient();
  const { city: userCity, province: userProvince } = await getUserLocationServer();
  const userCityLabel = formatCityLabel(userCity);
  const nowIso = new Date().toISOString();
  const params = searchParams ? await searchParams : undefined;
  const flashMessage = params?.message ?? "";
  const flashKind = params?.kind === "success" ? "success" : "info";
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myProfile } = user
    ? await supabase.from(DB_TABLES.profiles).select("gender").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const currentUserGender = (myProfile as { gender?: "masculino" | "femenino" | null } | null)?.gender ?? null;

  const { data: myFavorites } = user
    ? await supabase.from(DB_TABLES.userFavorites).select("favorite_user_id").eq("user_id", user.id)
    : { data: [] };
  const favoriteIds = ((myFavorites ?? []) as { favorite_user_id: string }[]).map(
    (f) => f.favorite_user_id
  );

  const { data, error } = await supabase
    .from(DB_TABLES.matches)
    .select(
      `
      id,
      date,
      owner_id,
      visibility,
      total_price,
      level_restricted,
      gender_category,
      category_range,
      courts (
        clubs (
          name,
          location,
          city,
          province
        )
      ),
      match_participants (
        player_id,
        team,
        profiles (
          name,
          avatar_url
        )
      )
    `
    )
    .gt("date", nowIso)
    .neq("match_status", "cancelled")
    .neq("match_type", "reservation")
    .order("date", { ascending: true });

  const rawMatches = (data ?? []) as unknown as MatchFeedRow[];
  const matches = rawMatches.filter((match) => {
    if (!isMatchPrivate(match.visibility)) return true;
    if (user?.id && match.owner_id && user.id === match.owner_id) return true;
    if (!match.owner_id) return true;
    return favoriteIds.includes(match.owner_id);
  });

  const cardData: MatchCardData[] = matches.map((match) => {
    const genderCategory = (match.gender_category ?? "mixto") as "masculino" | "femenino" | "mixto";
    const playersCount = match.match_participants?.length ?? 0;
    const freeSlots = Math.max(0, 4 - playersCount);
    const currentUserJoined = !!user?.id && (match.match_participants ?? []).some((p) => p.player_id === user.id);
    const userCanJoinByGender = genderCategory === "mixto" || (currentUserGender != null && currentUserGender === genderCategory);
    const genderLabel = genderCategory === "masculino" ? "Masculino" : genderCategory === "femenino" ? "Femenino" : "Mixto";
    const genderRestrictionMessage = !currentUserJoined && !userCanJoinByGender ? `Este partido es exclusivo para ${genderLabel}.` : null;
    const participants = (match.match_participants ?? []).map((mp) => {
      const prof = mp.profiles;
      const p = Array.isArray(prof) ? prof[0] : prof;
      return {
        player_id: mp.player_id,
        team: mp.team ?? null,
        name: p?.name?.trim() || "Jugador",
        avatar_url: p?.avatar_url ?? null,
      };
    });
    const club = match.courts?.clubs;
    const rawCity = club?.city?.trim() ? club.city : (club?.location ?? "").split(",")[0].trim();
    return {
      id: match.id,
      date: match.date,
      owner_id: match.owner_id ?? null,
      level_restricted: Boolean(match.level_restricted),
      gender_category: genderCategory,
      clubName: club?.name ?? "Club sin nombre",
      clubLocation: club?.location ?? "Ubicación pendiente",
      clubCity: normalizeCity(rawCity),
      clubProvince: club?.province?.trim() ?? "",
      categoryRange: (match as any).category_range ?? null,
      playersCount,
      freeSlots,
      currentUserJoined,
      userCanJoinByGender,
      genderRestrictionMessage,
      participants,
      team1Count: participants.filter((p) => p.team === 1).length,
      team2Count: participants.filter((p) => p.team === 2).length,
    };
  });

  const effectiveDescription = description;

  return (
    <MotionPage
      className={`mx-auto min-h-screen w-full space-y-6 bg-slate-50 px-4 pb-24 pt-6 ${
        mobileFirst ? "max-w-md" : "max-w-2xl"
      }`}
    >
      {backHref ? (
        <div className="mb-2 flex items-start justify-between gap-2">
          <PlayerStackHeader
            backHref={backHref}
            backLabel={backLabel}
            title={title}
            subtitle={effectiveDescription}
            className="mb-0 min-w-0 flex-1"
          />
          <div className="shrink-0 pt-1">
            <BuscarPartidoInfoButton />
          </div>
        </div>
      ) : (
        <header className="space-y-2">
          <p className="text-sm font-medium text-[#0085FC]">{kicker}</p>
          <h1 className="text-xl font-semibold leading-tight tracking-tight text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{effectiveDescription}</p>
        </header>
      )}

      {flashMessage ? (
        <section
          className={`rounded-[2rem] border p-4 text-sm shadow-sm ${
            flashKind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-[#0085FC]/20 bg-[#0085FC]/5 text-[#0085FC]"
          }`}
        >
          {flashMessage}
        </section>
      ) : null}

      {error ? (
        <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
          No pudimos cargar el listado en este momento: {error.message}
        </section>
      ) : null}

      {!error && matches.length === 0 ? (
        <EmptyStateCard
          title={emptyTitle}
          subtitle={emptySubtitle}
          ctaLabel={emptyCtaLabel}
          ctaHref={emptyCtaHref}
        />
      ) : null}

      {matches.length > 0 ? (
        <MatchesFilterBoard matches={cardData} userId={user?.id ?? null} userCity={userCity} userProvince={userProvince} />
      ) : null}
    </MotionPage>
  );
}
