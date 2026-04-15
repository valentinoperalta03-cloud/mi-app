import Link from "next/link";
import MotionPage from "@/components/motion-page";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import CreateMatchWizard from "./create-match-wizard";

type ClubOption = {
  id: string;
  name: string | null;
  location: string | null;
};

type CourtOption = {
  id: string;
  club_id: string;
  name: string | null;
  price: number | null;
};

type MatchReservation = {
  court_id: string;
  date: string;
};

function dateKeyFromIso(iso: string) {
  return iso.slice(0, 10);
}

function timeKeyFromIso(iso: string) {
  return iso.slice(11, 16);
}

export default async function CrearPartidoPage() {
  const supabase = await createClient();
  const today = new Date();
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 14);

  const [{ data: clubsRaw, error: clubsError }, { data: courtsRaw, error: courtsError }, { data: matchesRaw }] =
    await Promise.all([
      supabase.from(DB_TABLES.clubs).select("id, name, location").order("name", { ascending: true }),
      supabase.from(DB_TABLES.courts).select("id, club_id, name, price").order("name", { ascending: true }),
      supabase
        .from(DB_TABLES.matches)
        .select("court_id, date")
        .gte("date", today.toISOString())
        .lte("date", maxDate.toISOString()),
    ]);

  const clubs = (clubsRaw ?? []) as ClubOption[];
  const courts = (courtsRaw ?? []) as CourtOption[];
  const reservations = ((matchesRaw ?? []) as MatchReservation[]).map((item) => ({
    courtId: item.court_id,
    dateKey: dateKeyFromIso(item.date),
    timeKey: timeKeyFromIso(item.date),
  }));

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-slate-50 px-4 pb-32 pt-6">
      <header className="space-y-2">
        <Link href="/home" className="inline-block text-sm font-semibold text-sky-600 hover:text-sky-700">
          ← Volver al inicio
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Crear partido</h1>
        <p className="text-sm text-slate-500">
          Reserva tu cancha en pocos pasos y publica el partido para la comunidad.
        </p>
      </header>

      {clubsError || courtsError ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          No se pudo cargar la disponibilidad de clubes y canchas.
        </section>
      ) : (
        <CreateMatchWizard
          clubs={clubs.map((club) => ({
            id: club.id,
            name: club.name ?? "Club sin nombre",
            location: club.location ?? "Rosario",
          }))}
          courts={courts.map((court) => ({
            id: court.id,
            clubId: court.club_id,
            name: court.name ?? "Cancha",
            price: court.price ?? null,
          }))}
          reservations={reservations}
        />
      )}
    </MotionPage>
  );
}
