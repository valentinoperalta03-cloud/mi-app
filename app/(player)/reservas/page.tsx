import Image from "next/image";
import Link from "next/link";
import EmptyStateCard from "@/components/empty-state-card";
import MotionPage from "@/components/motion-page";
import { DB_TABLES } from "@/lib/db-tables";
import { PLAYER_CARD_INTERACTIVE, PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";

export default async function ReservasPage() {
  const supabase = await createClient();
  const { data: clubs, error } = await supabase
    .from(DB_TABLES.clubs)
    .select("id,name,location")
    .order("name");

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      <p className="text-sm font-medium text-sky-500">Inicio</p>
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">
        Reservar cancha
      </h1>
      <p className="text-sm font-light text-slate-500">
        Elegi un club en{" "}
        <code className="rounded bg-slate-100 px-1 text-xs">clubs</code> y horarios en{" "}
        <code className="rounded bg-slate-100 px-1 text-xs">court_schedules</code>.
      </p>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error.message}
        </div>
      ) : null}

      <p className="text-sm font-light text-slate-500">{(clubs?.length ?? 0)} clubes</p>

      {!error && (clubs?.length ?? 0) === 0 ? (
        <EmptyStateCard
          title="No hay clubes disponibles para reservar"
          subtitle="Activa la agenda de juego creando un partido y sumando canchas para la comunidad."
        />
      ) : null}

      <section className="space-y-3">
        {(clubs ?? []).map((club) => (
          <article
            key={club.id}
            className={`${PLAYER_CARD_INTERACTIVE} p-5`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <Image
                  src="/club-thumb.svg"
                  alt="Club"
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-2xl object-cover"
                />
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-950">
                    {club.name ?? "Club sin nombre"}
                  </h2>
                  <p className="text-sm font-light text-slate-500">
                    {club.location ?? "Sin ubicacion"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Link
                href={`/clubes/${club.id}`}
                className={PLAYER_PRIMARY_BUTTON}
              >
                Ver canchas
              </Link>
            </div>
          </article>
        ))}
      </section>
    </MotionPage>
  );
}
