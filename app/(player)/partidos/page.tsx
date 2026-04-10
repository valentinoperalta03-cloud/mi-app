import Image from "next/image";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import EmptyStateCard from "@/components/empty-state-card";
import MotionPage from "@/components/motion-page";
import { PLAYER_CARD_INTERACTIVE } from "@/lib/player-ui";
import {
  fetchUpcomingMatches,
  matchClubName,
  matchCourtName,
  matchCourtPrice,
  type UpcomingMatchRow,
} from "@/lib/matches";
import { createClient } from "@/utils/supabase/server";

export default async function PartidosPage() {
  const supabase = await createClient();
  const { data: rawMatches, error } = await fetchUpcomingMatches(supabase, {
    limit: 30,
  });
  const matches = (rawMatches ?? []) as unknown as UpcomingMatchRow[];

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      <p className="text-sm font-medium text-sky-500">Inicio</p>
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">Matches</h1>
      <p className="text-sm font-light text-slate-500">
        Partidos abiertos y proximos en la tabla{" "}
        <code className="rounded bg-slate-100 px-1 text-xs">matches</code>.
      </p>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error.message}
        </div>
      ) : null}

      <section className="space-y-3">
        {matches.map((item) => {
          const clubName = matchClubName(item);
          const courtPrice = matchCourtPrice(item);
          const when = format(parseISO(item.date), "EEE d MMM yyyy · HH:mm", {
            locale: es,
          });
          const n = item.match_players?.length ?? 0;

          return (
            <article
              key={item.id}
              className={`${PLAYER_CARD_INTERACTIVE} p-5`}
            >
              <div className="flex items-center gap-4">
                <Image
                  src="/club-thumb.svg"
                  alt="Club"
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-2xl object-cover"
                />
                <div className="flex-1">
                  <h2 className="text-xl font-bold tracking-tight text-slate-950">
                    {matchCourtName(item)}
                  </h2>
                  <p className="text-sm font-light text-slate-500">{clubName}</p>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                  {n} jug.
                </span>
              </div>
              <p className="mt-2 text-sm font-light text-slate-500">{when}</p>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-lg font-bold tracking-tight text-slate-950">
                  {courtPrice != null ? `$${courtPrice}` : "Consultar"}
                </p>
                <Link
                  href="/reservas"
                  className="rounded-2xl px-3 py-2 text-sm font-medium text-sky-600 transition-all duration-300 hover:opacity-95 active:scale-95"
                >
                  Reservar cancha
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      {!error && matches.length === 0 ? (
        <EmptyStateCard
          title="Nadie armo partido para hoy todavia"
          subtitle="Convoca jugadores cerca tuyo y crea el primer encuentro del dia en segundos."
        />
      ) : null}
    </MotionPage>
  );
}
