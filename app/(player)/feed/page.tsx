import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import EmptyStateCard from "@/components/empty-state-card";
import MotionPage from "@/components/motion-page";
import { PLAYER_CARD_INTERACTIVE } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";
import JoinMatchButton from "./join-match-button";

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
              level: string | null;
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

function getAverageLevelLabel(players: MatchFeedRow["match_players"]): string {
  const levels = (players ?? [])
    .map((player) => player.profiles?.level?.toLowerCase().trim() ?? "")
    .filter(Boolean);

  if (levels.length === 0) {
    return "Sin nivel definido";
  }

  const avg =
    levels.reduce((sum, level) => sum + (LEVEL_PRIORITY[level] ?? 1), 0) /
    levels.length;

  if (avg >= 3.5) return "Pro";
  if (avg >= 2.5) return "Avanzado";
  if (avg >= 1.5) return "Intermedio";
  return "Principiante";
}

type FeedPageProps = {
  searchParams?: Promise<{
    message?: string;
    kind?: string;
  }>;
};

export default async function FeedPage({ searchParams }: FeedPageProps) {
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
          level
        )
      )
    `
    )
    .gt("date", nowIso)
    .order("date", { ascending: true });

  const matches = (data ?? []) as unknown as MatchFeedRow[];

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-2xl space-y-5 bg-transparent px-4 pb-24 pt-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-sky-600">Feed</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Partidos abiertos
        </h1>
        <p className="text-sm text-slate-500">
          Unite a los proximos partidos segun tu nivel y disponibilidad.
        </p>
      </header>

      {flashMessage ? (
        <section
          className={`rounded-3xl border p-4 text-sm shadow-sm ${
            flashKind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-sky-200 bg-sky-50 text-sky-800"
          }`}
        >
          {flashMessage}
        </section>
      ) : null}

      {error ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
          No pudimos cargar el feed en este momento: {error.message}
        </section>
      ) : null}

      {!error && matches.length === 0 ? (
        <EmptyStateCard
          title="Nadie armo partido para hoy todavia"
          subtitle="Dale movimiento a la comunidad y crea un partido para que otros jugadores se sumen."
        />
      ) : null}

      <section className="space-y-4">
        {matches.map((match) => {
          const clubName = match.courts?.clubs?.name ?? "Club sin nombre";
          const clubLocation =
            match.courts?.clubs?.location ?? "Ubicacion pendiente";
          const playersCount = match.match_players?.length ?? 0;
          const freeSlots = Math.max(0, 4 - playersCount);
          const when = format(parseISO(match.date), "EEE d MMM · HH:mm", {
            locale: es,
          });
          const levelLabel = getAverageLevelLabel(match.match_players);

          return (
            <article
              key={match.id}
              className={`${PLAYER_CARD_INTERACTIVE} p-5`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                    {clubName}
                  </h2>
                  <p className="text-sm text-slate-500">{clubLocation}</p>
                </div>

                {match.is_competitive ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                    Partido Competitivo
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                <p>
                  <span className="font-medium text-slate-800">Hora:</span> {when}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Nivel promedio:</span>{" "}
                  {levelLabel}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Cupos libres:</span>{" "}
                  {freeSlots} / 4
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {playersCount} jugador(es) anotado(s)
                </p>

                {freeSlots > 0 && user?.id ? (
                  <JoinMatchButton matchId={match.id} userId={user.id} />
                ) : freeSlots > 0 ? (
                  <span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500">
                    Inicia sesion
                  </span>
                ) : (
                  <span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500">
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
