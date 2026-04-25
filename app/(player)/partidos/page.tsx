import Image from "next/image";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import EmptyStateCard from "@/components/empty-state-card";
import MotionPage from "@/components/motion-page";
import { Badge } from "@/components/ui/badge";
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
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-[var(--bg-app)] px-4 pb-24 pt-6">
      <header className="space-y-1">
        <p className="text-sm font-medium text-[#0585FC]">Inicio</p>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Matches</h1>
        <p className="text-sm font-light text-[var(--text-tertiary)]">
          Partidos abiertos y proximos en la tabla{" "}
          <code className="rounded bg-[var(--bg-subtle)] px-1 text-xs">matches</code>.
        </p>
      </header>

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
          const n = item.match_participants?.length ?? 0;

          return (
            <article key={item.id} className={`${PLAYER_CARD_INTERACTIVE} w-full overflow-hidden rounded-2xl p-5`}>
              <div className="flex items-center gap-4">
                <Image
                  src="/club-thumb.svg"
                  alt="Club"
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-2xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-bold leading-tight tracking-tight text-slate-950">
                    {matchCourtName(item)}
                  </h2>
                  <p className="truncate text-sm font-light text-[var(--text-tertiary)]">{clubName}</p>
                </div>
                <Badge variant="brand" className="shrink-0">
                  {n} jug.
                </Badge>
              </div>
              <p className="mt-2 text-sm font-light text-[var(--text-tertiary)]">{when}</p>
              <div className="mt-2 flex items-center justify-between">
                <p className="shrink-0 text-lg font-bold tracking-tight text-slate-950">
                  {courtPrice != null ? `$${courtPrice}` : "Consultar"}
                </p>
                <Link
                  href="/reservas"
                  className="rounded-2xl px-3 py-2 text-sm font-medium text-[#0585FC] transition-all duration-300 hover:opacity-95 active:scale-95"
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
          icon="padel"
          title="Sin partidos todavía"
          subtitle="Creá tu primer partido o unite a uno existente"
          ctaHref="/crear-partido"
          ctaLabel="Crear partido"
        />
      ) : null}
    </MotionPage>
  );
}
