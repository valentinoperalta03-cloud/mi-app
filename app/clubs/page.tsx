import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ClubRow = {
  id: string | number;
  name: string | null;
  address?: string | null;
  city?: string | null;
};

export default async function ClubsPage() {
  const { data, error } = await supabase.from("clubs").select("*").order("name");
  const clubs = (data ?? []) as ClubRow[];

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[hsl(var(--background))] px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-900">Clubs</h1>
      <p className="mt-1 text-sm text-slate-500">Listado de clubes disponibles</p>

      {error ? (
        <p className="mt-4 rounded-[24px] bg-red-50 p-4 text-sm text-red-600">
          Error cargando clubs: {error.message}
        </p>
      ) : null}

      <section className="mt-4 space-y-3 pb-6">
        {clubs.map((club) => (
          <Link
            key={club.id}
            href={`/clubs/${club.id}`}
            className="ui-card ui-interactive block p-5"
          >
            <h2 className="text-xl font-semibold text-slate-900">
              {club.name ?? "Club sin nombre"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {club.address || club.city || "Sin direccion"}
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}
