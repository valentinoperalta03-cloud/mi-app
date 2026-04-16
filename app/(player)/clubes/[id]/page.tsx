import Link from "next/link";
import { notFound } from "next/navigation";
import EmptyStateCard from "@/components/empty-state-card";
import MotionPage from "@/components/motion-page";
import { DB_TABLES } from "@/lib/db-tables";
import type { ClubRow, CourtRow } from "@/lib/database.types";
import { PLAYER_CARD_INTERACTIVE, PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClubDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: clubRow, error: clubError } = await supabase
    .from(DB_TABLES.clubs)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (clubError || !clubRow) {
    notFound();
  }

  const club = clubRow as ClubRow;

  const { data: courtsData } = await supabase
    .from(DB_TABLES.courts)
    .select("*")
    .eq("club_id", id)
    .order("name");

  const courts = (courtsData ?? []) as CourtRow[];
  const clubName = club.name ?? "Club";
  const location = club.location ?? "";

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      <header className="space-y-1">
        <p className="text-sm font-medium text-sky-600">Club</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">{clubName}</h1>
        {location ? <p className="text-sm font-light text-slate-500">{location}</p> : null}
      </header>

      {courts.length === 0 ? (
        <EmptyStateCard
          title="Este club no tiene canchas disponibles"
          subtitle="Volvé más tarde o elegí otro club desde la lista."
          ctaHref="/reservas"
          ctaLabel="Ver otros clubes"
        />
      ) : (
        <section className="space-y-3">
          {courts.map((court) => {
            const price = court.price ?? 0;
            const courtName = court.name ?? "Cancha";
            const href = `/reservas/nueva?court_id=${encodeURIComponent(court.id)}&club_name=${encodeURIComponent(clubName)}&court_name=${encodeURIComponent(courtName)}&price=${encodeURIComponent(String(price))}`;
            return (
              <article key={court.id} className={`${PLAYER_CARD_INTERACTIVE} p-5`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-950">{courtName}</h2>
                    <p className="text-sm font-medium text-sky-700">${price}/hora</p>
                  </div>
                  <Link href={href} className={`inline-flex justify-center ${PLAYER_PRIMARY_BUTTON}`}>
                    Reservar
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </MotionPage>
  );
}
