import EmptyStateCard from "@/components/empty-state-card";
import { BuscarPartidoInfoButton } from "@/components/buscar-partido-info-button";
import MatchesFilterBoard, { type MatchCardData } from "@/components/matches-filter-board";
import MotionPage from "@/components/motion-page";
import { PlayerStackHeader } from "@/components/player-back-button";
import { DB_TABLES } from "@/lib/db-tables";
import { formatLevel } from "@/lib/level-quiz-logic";
import { isMatchPrivate } from "@/lib/match-visibility";
import { formatProfileNivelFromRow, splitOfficialCategoryLine } from "@/lib/profile-display";
import { createClient } from "@/utils/supabase/server";

type MatchFeedRow = {
  id: string;
  date: string;
  owner_id?: string | null;
  visibility?: "publico" | "privado" | string | null;
  total_price?: number | null;
  is_competitive?: boolean | null;
  level_restricted?: boolean | null;
  gender_category?: "masculino" | "femenino" | "mixto" | null;
  courts:
    | {
        clubs:
          | {
              name: string | null;
              location: string | null;
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
              level?: number | null;
              level_of_play: string | null;
              technical_score?: number | null;
            }
          | null;
      }[]
    | null;
};

function getAverageLevelLabel(players: MatchFeedRow["match_participants"]): string {
  const list = players ?? [];
  const numericLevels: number[] = [];
  for (const player of list) {
    const prof = player.profiles;
    const p = Array.isArray(prof) ? prof[0] : prof;
    const level = p?.level;
    if (level != null && Number.isFinite(Number(level))) numericLevels.push(Number(level));
  }
  if (numericLevels.length === list.length && numericLevels.length > 0) {
    const avg = numericLevels.reduce((a, b) => a + b, 0) / numericLevels.length;
    return formatLevel(avg);
  }
  const fallbackOfficial = list
    .map((player) => {
      const p = Array.isArray(player.profiles) ? player.profiles[0] : player.profiles;
      return formatProfileNivelFromRow(p ?? null);
    })
    .find((line) => line && line !== "—");
  return fallbackOfficial ?? "Sin nivel definido";
}

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
  emptyCtaHref = "/partidos/nuevo",
  mobileFirst = false,
  backHref,
  backLabel = "Volver al inicio",
}: OpenMatchesBoardProps) {
  const supabase = await createClient();
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
    ? await supabase.from(DB_TABLES.userFavorites).select("favorite_id").eq("user_id", user.id)
    : { data: [] };
  const favoriteIds = ((myFavorites ?? []) as { favorite_id: string }[]).map((f) => f.favorite_id);

  const { data, error } = await supabase
    .from(DB_TABLES.matches)
    .select(
      `
      id,
      date,
      owner_id,
      visibility,
      total_price,
      is_competitive,
      level_restricted,
      gender_category,
      courts (
        clubs (
          name,
          location
        )
      ),
      match_participants (
        player_id,
        team,
        profiles (
          name,
          avatar_url,
          level,
          level_of_play,
          technical_score
        )
      )
    `
    )
    .gt("date", nowIso)
    .neq("match_status", "cancelled")
    .order("date", { ascending: true });

  const rawMatches = (data ?? []) as unknown as MatchFeedRow[];
  const matches = rawMatches
    .filter((match) => {
      if (!isMatchPrivate(match.visibility)) return true;
      if (user?.id && match.owner_id && user.id === match.owner_id) return true;
      if (!match.owner_id) return true;
      return favoriteIds.includes(match.owner_id);
    })
    .filter((match) => (match.match_participants?.length ?? 0) > 0);

  const cardData: MatchCardData[] = matches.map((match) => {
    const genderCategory = (match.gender_category ?? "mixto") as "masculino" | "femenino" | "mixto";
    const playersCount = match.match_participants?.length ?? 0;
    const freeSlots = Math.max(0, 4 - playersCount);
    const currentUserJoined = !!user?.id && (match.match_participants ?? []).some((p) => p.player_id === user.id);
    const userCanJoinByGender = genderCategory === "mixto" || (currentUserGender != null && currentUserGender === genderCategory);
    const genderLabel = genderCategory === "masculino" ? "Masculino" : genderCategory === "femenino" ? "Femenino" : "Mixto";
    const genderRestrictionMessage = !currentUserJoined && !userCanJoinByGender ? `Este partido es exclusivo para ${genderLabel}.` : null;
    const turnTotal = Number(match.total_price ?? 0);
    const turnTotalWithFee = turnTotal * 1.05;
    const joinShare = turnTotalWithFee > 0 ? Math.round((turnTotalWithFee / 4) * 100) / 100 : 0;
    const levelLabel = getAverageLevelLabel(match.match_participants);
    const levelParts = splitOfficialCategoryLine(levelLabel);
    const participants = (match.match_participants ?? []).map((mp) => {
      const prof = mp.profiles;
      const p = Array.isArray(prof) ? prof[0] : prof;
      const nivelLine = formatProfileNivelFromRow(p ?? null);
      const nivelParts = splitOfficialCategoryLine(nivelLine);
      return {
        player_id: mp.player_id,
        team: mp.team ?? null,
        name: p?.name?.trim() || "Jugador",
        avatar_url: p?.avatar_url ?? null,
        nivelCategory: nivelParts.category ?? "",
        nivelDescription: nivelParts.description ?? "",
      };
    });
    return {
      id: match.id,
      date: match.date,
      owner_id: match.owner_id ?? null,
      is_competitive: Boolean(match.is_competitive),
      level_restricted: Boolean(match.level_restricted),
      gender_category: genderCategory,
      clubName: match.courts?.clubs?.name ?? "Club sin nombre",
      clubLocation: match.courts?.clubs?.location ?? "Ubicación pendiente",
      playersCount,
      freeSlots,
      joinShare,
      currentUserJoined,
      userCanJoinByGender,
      genderRestrictionMessage,
      levelLabel,
      levelCategory: levelParts.category ?? "",
      levelDescription: levelParts.description ?? "",
      participants,
      team1Count: participants.filter((p) => p.team === 1).length,
      team2Count: participants.filter((p) => p.team === 2).length,
    };
  });

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
            subtitle={description}
            className="mb-0 min-w-0 flex-1"
          />
          <div className="shrink-0 pt-1">
            <BuscarPartidoInfoButton />
          </div>
        </div>
      ) : (
        <header className="space-y-2">
          <p className="text-sm font-medium text-[#0585FC]">{kicker}</p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{description}</p>
        </header>
      )}

      {flashMessage ? (
        <section
          className={`rounded-[2rem] border p-4 text-sm shadow-sm ${
            flashKind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-[#0585FC]/20 bg-[#0585FC]/5 text-[#0585FC]"
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
        <MatchesFilterBoard matches={cardData} userId={user?.id ?? null} />
      ) : null}
    </MotionPage>
  );
}
