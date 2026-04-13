import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import JoinMatchButton from "@/app/(player)/feed/join-match-button";
import EmptyStateCard from "@/components/empty-state-card";
import MotionPage from "@/components/motion-page";
import { PLAYER_CARD_INTERACTIVE } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";

type MatchFeedRow = {
  id: string;
  date: string;
  is_competitive?: boolean | null;
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
  match_players:
    | {
        player_id: string;
        profiles:
          | {
              name: string | null;
              level_of_play: string | null;
            }
          | null;
      }[]
    | null;
};

const LEVEL_PRIORITY: Record<string, number> = {
  beginner: 1,
  intermedio: 2,
  intermediate: 2,
  advanced: 3,
  avanzado: 3,
  pro: 4,
};

function levelToNumeric(levelLabel: string): number {
  const trimmed = levelLabel.trim();
  if (!trimmed) return 0;
  const asNum = Number(trimmed);
  if (!Number.isNaN(asNum)) return asNum;
  return LEVEL_PRIORITY[trimmed] ?? 1;
}

function getAverageLevelLabel(players: MatchFeedRow["match_players"]): string {
  const levels = (players ?? [])
    .map((player) => {
      const raw = player.profiles?.level_of_play;
      if (raw === null || raw === undefined) return "";
      return String(raw).toLowerCase().trim();
    })
    .filter(Boolean);

  if (levels.length === 0) {
    return "Sin nivel definido";
  }

  const avg =
    levels.reduce((sum, level) => sum + levelToNumeric(level), 0) / levels.length;

  if (avg >= 4.5) return "Pro";
  if (avg >= 3.5) return "Avanzado";
  if (avg >= 2.5) return "Intermedio";
  return "Inicial";
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

  const { data, error } = await supabase
    .from("matches")
    .select(
      `
      id,
      date,
      is_competitive,
      courts (
        clubs (
          name,
          location
        )
      ),
      match_players (
        player_id,
        profiles (
          name,
          level_of_play
        )
      )
    `
    )
    .gt("date", nowIso)
    .order("date", { ascending: true });

  const matches = (data ?? []) as unknown as MatchFeedRow[];

  return (
    <MotionPage
      className={`mx-auto min-h-screen w-full space-y-6 bg-slate-50 px-4 pb-32 pt-6 ${
        mobileFirst ? "max-w-md" : "max-w-2xl"
      }`}
    >
      <header className="space-y-2">
        <p className="text-sm font-medium text-sky-600">{kicker}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
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
          const playersCount = match.match_players?.length ?? 0;
          const freeSlots = Math.max(0, 4 - playersCount);
          const when = format(parseISO(match.date), "EEE d MMM · HH:mm", {
            locale: es,
          });
          const levelLabel = getAverageLevelLabel(match.match_players);

          return (
            <article
              key={match.id}
              className={`${PLAYER_CARD_INTERACTIVE} rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-900">{clubName}</h2>
                  <p className="text-sm text-slate-500">{clubLocation}</p>
                </div>

                {match.is_competitive ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                    Partido competitivo
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                <p>
                  <span className="font-medium text-slate-800">Hora:</span> {when}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Nivel promedio:</span> {levelLabel}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Cupos libres:</span> {freeSlots} / 4
                </p>
              </div>

              {match.match_players && match.match_players.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {match.match_players.map((mp) => {
                    const prof = mp.profiles;
                    const p = Array.isArray(prof) ? prof[0] : prof;
                    const label = p?.name?.trim() || "Jugador";
                    return (
                      <li key={mp.player_id}>
                        <Link
                          href={`/jugador/${mp.player_id}`}
                          className="font-semibold text-sky-700 underline decoration-sky-200/70 underline-offset-2 hover:text-sky-800"
                        >
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">{playersCount} jugador(es) anotado(s)</p>

                {freeSlots > 0 && user?.id ? (
                  <JoinMatchButton matchId={match.id} userId={user.id} />
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
