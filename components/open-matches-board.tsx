import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import JoinToggleButton from "@/app/(player)/buscar-partido/join-toggle-button";
import EmptyStateCard from "@/components/empty-state-card";
import MotionPage from "@/components/motion-page";
import { ProfileAvatar } from "@/components/profile-avatar";
import { DB_TABLES } from "@/lib/db-tables";
import { formatLevel } from "@/lib/level-quiz-logic";
import { PLAYER_CARD_INTERACTIVE } from "@/lib/player-ui";
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
  const matches = rawMatches.filter((match) => {
    const vis = String(match.visibility ?? "publico").toLowerCase();
    if (vis !== "privado") return true;
    if (user?.id && match.owner_id && user.id === match.owner_id) return true;
    if (!match.owner_id) return true;
    return favoriteIds.includes(match.owner_id);
  });

  return (
    <MotionPage
      className={`mx-auto min-h-screen w-full space-y-6 bg-slate-50 px-4 pb-24 pt-6 ${
        mobileFirst ? "max-w-md" : "max-w-2xl"
      }`}
    >
      <header className="space-y-2">
        <p className="text-sm font-medium text-sky-600">{kicker}</p>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{description}</p>
      </header>

      {flashMessage ? (
        <section
          className={`rounded-[2rem] border p-4 text-sm shadow-sm ${
            flashKind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-sky-200 bg-sky-50 text-sky-800"
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

      <section className="space-y-4">
        {matches.map((match) => {
          const clubName = match.courts?.clubs?.name ?? "Club sin nombre";
          const clubLocation = match.courts?.clubs?.location ?? "Ubicación pendiente";
          const playersCount = match.match_participants?.length ?? 0;
          const freeSlots = Math.max(0, 4 - playersCount);
          const when = format(parseISO(match.date), "EEE d MMM · HH:mm", {
            locale: es,
          });
          const levelLabel = getAverageLevelLabel(match.match_participants);
          const levelParts = splitOfficialCategoryLine(levelLabel);
          const currentUserJoined =
            !!user?.id &&
            (match.match_participants ?? []).some((participant) => participant.player_id === user.id);
          const genderCategory = match.gender_category ?? "mixto";
          const categoryLabel =
            genderCategory === "masculino"
              ? "Masculino"
              : genderCategory === "femenino"
                ? "Femenino"
                : "Mixto";
          const userCanJoinByGender =
            genderCategory === "mixto" || (currentUserGender != null && currentUserGender === genderCategory);
          const genderRestrictionMessage =
            !currentUserJoined && !userCanJoinByGender
              ? `Este partido es exclusivo para ${categoryLabel}.`
              : null;

          const turnTotal = Number(match.total_price ?? 0);
          const joinShare =
            turnTotal > 0 ? Math.round((turnTotal / 4) * 100) / 100 : 0;
          const requiresPaymentToJoin = turnTotal > 0 && !currentUserJoined;

          return (
            <article
              key={match.id}
              className={`${PLAYER_CARD_INTERACTIVE} w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="truncate text-xl font-semibold leading-tight tracking-tight text-slate-900">{clubName}</h2>
                  <p className="truncate text-sm text-slate-500">{clubLocation}</p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {categoryLabel}
                  </span>
                  {match.is_competitive ? (
                    <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                      Partido competitivo
                    </span>
                  ) : null}
                  {match.level_restricted ? (
                    <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                      Nivel restringido 🎯
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                <p>
                  <span className="font-medium text-slate-800">Hora:</span> {when}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Nivel promedio:</span>{" "}
                  <span className="text-sky-700">
                    <span className="font-bold">{levelParts.category || "—"}</span>
                    {levelParts.description ? (
                      <span className="font-medium">{" - "}{levelParts.description}</span>
                    ) : null}
                  </span>
                </p>
                {turnTotal > 0 ? (
                  <p>
                    <span className="font-medium text-slate-800">💳 Costo para unirse:</span>{" "}
                    <span className="font-semibold text-sky-800">${joinShare}</span>
                  </p>
                ) : null}
                <p>
                  <span className="font-medium text-slate-800">Cupos libres:</span> {freeSlots} / 4
                </p>
              </div>

              {match.match_participants && match.match_participants.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                  {match.match_participants.map((mp) => {
                    const prof = mp.profiles;
                    const p = Array.isArray(prof) ? prof[0] : prof;
                    const label = p?.name?.trim() || "Jugador";
                    const nivelLine = formatProfileNivelFromRow(p ?? null);
                    const nivelParts = splitOfficialCategoryLine(nivelLine);
                    return (
                      <li key={mp.player_id}>
                        <Link
                          href={`/jugador/${mp.player_id}`}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-sky-700 hover:text-sky-800"
                        >
                          <ProfileAvatar
                            avatarUrl={p?.avatar_url ?? null}
                            name={label}
                            size={24}
                            ringClassName="ring-1 ring-white"
                          />
                          <span className="flex flex-col leading-tight">
                            <span>{label}</span>
                            <span className="text-[10px] font-medium text-sky-600/90">
                              <span className="font-bold">{nivelParts.category || "—"}</span>
                              {nivelParts.description ? (
                                <span>{" - "}{nivelParts.description}</span>
                              ) : null}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <div className="mt-4 flex items-center justify-between">
                <p className="min-w-0 text-xs text-slate-500">{playersCount} jugador(es) anotado(s)</p>

                {user?.id ? (
                  freeSlots > 0 || currentUserJoined ? (
                    <JoinToggleButton
                      matchId={match.id}
                      isJoined={currentUserJoined}
                      levelRestricted={Boolean(match.level_restricted)}
                      requiresPayment={requiresPaymentToJoin}
                      disabled={!currentUserJoined && !userCanJoinByGender}
                      disabledMessage={genderRestrictionMessage ?? undefined}
                    />
                  ) : (
                    <span className="rounded-[2rem] border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500">
                      Completo
                    </span>
                  )
                ) : freeSlots > 0 ? (
                  <span className="rounded-[2rem] border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500">
                    Iniciá sesión
                  </span>
                ) : (
                  <span className="rounded-[2rem] border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500">
                    Completo
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </MotionPage>
  );
}
