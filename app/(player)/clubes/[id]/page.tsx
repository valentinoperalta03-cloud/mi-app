import Link from "next/link";
import { notFound } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { supabase } from "@/lib/supabase";

type ClubDetailProps = {
  params: Promise<{ id: string }>;
};

type ClubRow = {
  id: string | number;
  name: string | null;
  location?: string | null;
};

type CourtRow = {
  id: string | number;
  name: string | null;
  price?: number | string | null;
};

export default async function ClubDetailPage({ params }: ClubDetailProps) {
  const { id } = await params;

  const { data: clubData, error: clubError } = await supabase
    .from(DB_TABLES.clubs)
    .select("*")
    .eq("id", id)
    .single();

  if (clubError || !clubData) {
    notFound();
  }

  const club = clubData as ClubRow;

  const { data: courtsData, error: courtsError } = await supabase
    .from(DB_TABLES.courts)
    .select("*")
    .eq("club_id", id)
    .order("name");

  const courts = (courtsData ?? []) as CourtRow[];

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-slate-50 px-4 pb-24 pt-6">
      <Link href="/clubes" className="text-sm font-medium text-sky-500">
        Volver a clubes
      </Link>

      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h1 className="text-2xl font-bold text-slate-900">{club.name ?? "Club sin nombre"}</h1>
        <p className="mt-1 text-sm text-slate-500">{club.location || "Sin ubicacion"}</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Disponibilidad de canchas</h2>
        {courtsError ? (
          <p className="mt-2 rounded-2xl bg-rose-50 p-4 text-sm text-rose-600">
            Error cargando canchas: {courtsError.message}
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            {courts.map((court) => (
              <article key={court.id} className="rounded-2xl border border-slate-100 bg-white p-5">
                <p className="text-base font-semibold text-slate-900">{court.name ?? "Cancha sin nombre"}</p>
                <p className="mt-1 text-sm text-slate-500">Precio: {court.price ?? "-"}</p>
              </article>
            ))}
            {!courts.length ? (
              <p className="text-sm text-slate-500">Este club aun no tiene canchas.</p>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
