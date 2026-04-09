import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import MotionPage from "@/components/motion-page";
import {
  fetchUpcomingMatches,
  matchClubName,
  matchCourtName,
  type UpcomingMatchRow,
} from "@/lib/matches";
import { createClient } from "@/utils/supabase/server";

export default async function InicioPage() {
  const supabase = await createClient();
  const { data: rawMatches, error } = await fetchUpcomingMatches(supabase, {
    limit: 8,
  });
  const matches = (rawMatches ?? []) as unknown as UpcomingMatchRow[];

  const quickActions = [
    {
      title: "Reservar pista",
      subtitle: "Encontra y reserva tu cancha ideal",
      href: "/clubes",
    },
    {
      title: "Aprender",
      subtitle: "Clases y entrenamientos para mejorar",
      href: "/perfil",
    },
    {
      title: "Competir",
      subtitle: "Torneos y competencias activas",
      href: "/partidos",
    },
    {
      title: "Buscar partido",
      subtitle: "Unite a matches abiertos",
      href: "/partidos",
    },
  ];

  const first = matches[0];
  const firstClubName = first ? matchClubName(first) : "Club";
  const firstWhen = first?.date
    ? format(parseISO(first.date), "EEE d MMM HH:mm", { locale: es })
    : null;
  const firstPlayers = first?.match_players?.length ?? 0;

  return (
    <MotionPage className="mx-auto flex min-h-screen w-full max-w-md flex-col space-y-6 bg-transparent px-4 pb-24 pt-6">
      <section className="rounded-3xl bg-sky-600 p-6 text-white shadow-sm">
        <p className="text-sm font-light text-blue-100">Vamos!</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight leading-tight">
          Todo listo para tu partido.
        </h1>
        <p className="mt-2 text-sm font-light text-blue-100">Jugador</p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {quickActions.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-sky-200 hover:shadow-lg active:scale-95"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-sky-100" />
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-950">
                  {item.title}
                </h2>
                <p className="text-sm font-light text-slate-500">{item.subtitle}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <h3 className="text-2xl font-bold tracking-tight text-slate-950">
          Proximos matches
        </h3>
        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            No se pudieron cargar los partidos: {error.message}
          </p>
        ) : null}
        {!error && matches.length === 0 ? (
          <p className="text-sm font-light text-slate-500">
            Todavia no hay matches publicados. Entra a Partidos o reserva una cancha.
          </p>
        ) : null}
        <ul className="space-y-2">
          {matches.slice(0, 5).map((m) => {
            const clubName = matchClubName(m);
            const when = format(parseISO(m.date), "EEE d MMM HH:mm", {
              locale: es,
            });
            const n = m.match_players?.length ?? 0;
            return (
              <li
                key={m.id}
                className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm shadow-sm"
              >
                <p className="font-semibold text-slate-900">{when}</p>
                <p className="text-slate-600">
                  {clubName} · {matchCourtName(m)}
                </p>
                <p className="text-xs text-slate-500">{n} jugador(es) anotados</p>
              </li>
            );
          })}
        </ul>
        <Link
          href="/partidos"
          className="inline-block text-sm font-semibold text-sky-600 hover:opacity-90"
        >
          Ver todos los matches
        </Link>
      </section>

      <section className="space-y-3">
        <h3 className="text-2xl font-bold tracking-tight text-slate-950">
          Proximo partido
        </h3>
        <article className="rounded-3xl bg-sky-600 p-5 text-white shadow-sm">
          {first && firstWhen ? (
            <>
              <p className="text-xl font-bold">{firstWhen}</p>
              <p className="text-sm font-light text-blue-100">{firstClubName}</p>
              <p className="mt-1 text-xs font-light text-blue-100">
                {firstPlayers} jugador(es) · {matchCourtName(first)}
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold">Sin partidos programados</p>
              <p className="text-sm font-light text-blue-100">
                Reserva cancha o mira matches abiertos
              </p>
            </>
          )}
          <Link
            href="/partidos"
            className="mt-3 block w-full rounded-3xl bg-white/20 px-4 py-2 text-center text-sm font-medium transition-all duration-300 hover:opacity-95 active:scale-95"
          >
            Ver detalles
          </Link>
        </article>
      </section>

      <section className="space-y-3">
        <h3 className="text-2xl font-bold tracking-tight text-slate-950">
          Tu resumen
        </h3>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            [String(matches.length), "Matches feed"],
            ["—", "Reservas"],
            ["—", "Nivel"],
          ].map(([value, label]) => (
            <article
              key={label}
              className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
            >
              <p className="text-3xl font-bold tracking-tight text-slate-950">
                {value}
              </p>
              <p className="mt-1 text-sm font-light text-slate-500">{label}</p>
            </article>
          ))}
        </div>
      </section>
    </MotionPage>
  );
}
