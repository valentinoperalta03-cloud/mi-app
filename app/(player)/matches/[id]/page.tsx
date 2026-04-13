import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock, Users } from "lucide-react";
import MotionPage from "@/components/motion-page";
import {
  fetchMatchById,
  matchClubName,
  matchCourtName,
  matchCourtPrice,
  type UpcomingMatchRow,
} from "@/lib/matches";
import { createClient } from "@/utils/supabase/server";

type PageProps = { params: Promise<{ id: string }> };

export default async function MatchDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: raw, error } = await fetchMatchById(supabase, id);
  if (error || !raw) {
    redirect("/partidos");
  }

  const m = raw as unknown as UpcomingMatchRow;
  const when = format(parseISO(m.date), "EEEE d MMMM yyyy · HH:mm", { locale: es });
  const price = matchCourtPrice(m);
  const n = m.match_players?.length ?? 0;
  const players = m.match_players ?? [];

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-28 pt-6">
      <Link
        href="/home"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-sky-600"
      >
        <ArrowLeft size={18} strokeWidth={2} />
        Volver
      </Link>

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Partido</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {m.is_competitive ? "Competitivo" : "Dobles amistoso"}
        </h1>
      </header>

      <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-lg font-bold text-slate-900">{matchCourtName(m)}</p>
        <p className="text-sm font-medium text-slate-500">{matchClubName(m)}</p>
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <Clock size={16} className="text-sky-600" strokeWidth={2} />
          {when}
        </div>
        <p className="mt-3 text-sm text-slate-600">{n} jugador(es) anotados</p>
        <p className="mt-2 text-xl font-bold text-slate-900">
          {price != null ? `$${price}` : "Consultar precio"}
        </p>
      </article>

      {players.length > 0 ? (
        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-2 text-slate-900">
            <Users size={18} className="text-sky-600" strokeWidth={2} aria-hidden />
            <h2 className="text-sm font-bold tracking-tight">Jugadores</h2>
          </div>
          <ul className="mt-3 space-y-2">
            {players.map((mp) => {
              const prof = mp.profiles;
              const p = Array.isArray(prof) ? prof[0] : prof;
              const name = p?.name?.trim() || "Jugador";
              return (
                <li key={mp.player_id}>
                  <Link
                    href={`/jugador/${mp.player_id}`}
                    className="text-sm font-semibold text-sky-700 underline decoration-sky-200/80 underline-offset-2 transition hover:text-sky-800"
                  >
                    {name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <Link
        href="/buscar-partido"
        className="flex w-full items-center justify-center rounded-2xl bg-sky-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-sky-500"
      >
        Ver en feed y unirme
      </Link>
    </MotionPage>
  );
}
