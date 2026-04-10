import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import MotionPage from "@/components/motion-page";
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

export default async function FeedPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

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

      {error ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
          No pudimos cargar el feed en este momento: {error.message}
        </section>
      ) : null}

      {!error && matches.length === 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-medium text-slate-800">
            No hay partidos disponibles por ahora.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Volve en unos minutos para ver nuevos encuentros abiertos.
          </p>
        </section>
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
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition-all duration-300 hover:border-sky-200 hover:shadow-[0_16px_38px_rgba(14,116,144,0.12)]"
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

                {freeSlots > 0 ? (
                  <Link
                    href={`/partidos?join=${match.id}`}
                    className="rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-300 hover:opacity-95 active:scale-95"
                  >
                    Unirse
                  </Link>
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
