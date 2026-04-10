import Link from "next/link";
import MotionPage from "@/components/motion-page";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import CreateMatchForm from "./create-match-form";

type ClubOption = {
  id: string;
  name: string | null;
  location: string | null;
};

type CourtOption = {
  id: string;
  club_id: string;
  name: string | null;
};

function todayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function NuevoPartidoPage() {
  const supabase = await createClient();

  const [{ data: clubsRaw, error: clubsError }, { data: courtsRaw, error: courtsError }] =
    await Promise.all([
      supabase
        .from(DB_TABLES.clubs)
        .select("id, name, location")
        .order("name", { ascending: true }),
      supabase
        .from(DB_TABLES.courts)
        .select("id, club_id, name")
        .order("name", { ascending: true }),
    ]);

  const clubs = (clubsRaw ?? []) as ClubOption[];
  const courts = (courtsRaw ?? []) as CourtOption[];
  const defaultDate = todayDateInputValue();

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-2xl space-y-6 bg-transparent px-4 pb-24 pt-6">
      <header className="space-y-2">
        <Link href="/partidos" className="text-sm font-medium text-sky-600 hover:opacity-90">
          Volver a partidos
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Crear nuevo partido
        </h1>
        <p className="text-sm text-slate-500">
          Configura club, cancha y tipo de encuentro en un solo paso.
        </p>
      </header>

      {clubsError || courtsError ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          No se pudo cargar la configuracion del formulario.
        </section>
      ) : null}

      {!clubsError && !courtsError && clubs.length === 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No hay clubes disponibles. Crea al menos un club para poder publicar partidos.
        </section>
      ) : null}

      {!clubsError && !courtsError && clubs.length > 0 ? (
        <CreateMatchForm
          clubs={clubs.map((club) => ({
            id: club.id,
            name: club.name ?? "Club sin nombre",
            location: club.location ?? "Ubicacion pendiente",
          }))}
          courts={courts.map((court) => ({
            id: court.id,
            club_id: court.club_id,
            name: court.name ?? "Cancha",
          }))}
          defaultDate={defaultDate}
        />
      ) : null}
    </MotionPage>
  );
}
