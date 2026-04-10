import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import SlotToggleForm from "./slot-toggle-form";

const SLOT_TIMES = [
  "07:30",
  "09:00",
  "10:30",
  "12:00",
  "13:30",
  "15:00",
  "16:30",
  "18:00",
  "19:30",
  "21:00",
  "22:30",
] as const;

type GestionPageProps = {
  searchParams?: Promise<{
    date?: string;
    court?: string;
  }>;
};

type ClubRow = {
  id: string;
  name: string | null;
};

type CourtRow = {
  id: string;
  name: string | null;
  club_id: string;
};

type MatchRow = {
  date: string;
  court_id: string;
};

type BlockRow = {
  court_id: string;
  date: string;
  start_time: string;
};

function formatToday() {
  return format(new Date(), "yyyy-MM-dd");
}

export default async function ClubGestionPage({ searchParams }: GestionPageProps) {
  const supabase = await createClient();
  const params = searchParams ? await searchParams : undefined;
  const selectedDate = params?.date ?? formatToday();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: clubsData, error: clubsError } = await supabase
    .from(DB_TABLES.clubs)
    .select("id,name")
    .eq("owner_id", user.id)
    .order("name");

  const clubs = (clubsData ?? []) as ClubRow[];
  if (!clubsError && clubs.length === 0) {
    console.log("[club/gestion] No clubs for user_id:", user.id);
  }
  const clubIds = clubs.map((club) => club.id);

  const { data: courtsData, error: courtsError } = clubIds.length
    ? await supabase
        .from(DB_TABLES.courts)
        .select("id,name,club_id")
        .in("club_id", clubIds)
        .order("name")
    : { data: [], error: null };

  const courts = (courtsData ?? []) as CourtRow[];
  const selectedCourtId =
    params?.court && courts.some((court) => court.id === params.court)
      ? params.court
      : courts[0]?.id ?? "";

  const dayStartIso = `${selectedDate}T00:00:00`;
  const nextDayIso = format(addDays(new Date(dayStartIso), 1), "yyyy-MM-dd'T'00:00:00");

  const { data: matchesData, error: matchesError } = selectedCourtId
    ? await supabase
        .from(DB_TABLES.matches)
        .select("date,court_id")
        .eq("court_id", selectedCourtId)
        .gte("date", dayStartIso)
        .lt("date", nextDayIso)
    : { data: [], error: null };

  const { data: blocksData, error: blocksError } = selectedCourtId
    ? await supabase
        .from(DB_TABLES.courtBlocks)
        .select("court_id,date,start_time")
        .eq("court_id", selectedCourtId)
        .eq("date", selectedDate)
    : { data: [], error: null };

  const matches = (matchesData ?? []) as MatchRow[];
  const blocks = (blocksData ?? []) as BlockRow[];

  const matchTimes = new Set(matches.map((m) => format(parseISO(m.date), "HH:mm")));
  const blockTimes = new Set(
    blocks.map((b) => (b.start_time.length >= 5 ? b.start_time.slice(0, 5) : b.start_time))
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 bg-transparent px-4 pb-24 pt-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-sky-600">Admin Club</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Gestion de disponibilidad
        </h1>
        <p className="text-sm text-slate-500">
          Turnos fijos de 90 minutos entre 07:30 y 22:30.
        </p>
      </header>

      {clubsError || courtsError || matchesError || blocksError ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {clubsError?.message ||
            courtsError?.message ||
            matchesError?.message ||
            blocksError?.message}
        </section>
      ) : null}

      {!clubsError && clubs.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-medium text-slate-800">
            No administras ningun club todavia.
          </p>
        </section>
      ) : null}

      {clubs.length > 0 ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <label htmlFor="manage-date" className="text-sm font-medium text-slate-700">
              Fecha a gestionar
            </label>
            <form className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="court" value={selectedCourtId} />
              <input
                id="manage-date"
                name="date"
                type="date"
                defaultValue={selectedDate}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
              />
              <button
                type="submit"
                className="rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-300 hover:opacity-95"
              >
                Ver dia
              </button>
            </form>
          </div>

          <div className="flex flex-wrap gap-2">
            {courts.map((court) => {
              const active = court.id === selectedCourtId;
              return (
                <Link
                  key={court.id}
                  href={`/club/gestion?court=${court.id}&date=${selectedDate}`}
                  className={`rounded-2xl border px-4 py-2 text-sm font-medium transition-all duration-300 ${
                    active
                      ? "border-sky-500 bg-sky-500 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:text-sky-700"
                  }`}
                >
                  {court.name ?? "Cancha"}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {selectedCourtId ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SLOT_TIMES.map((slot) => {
            const hasMatch = matchTimes.has(slot);
            const isBlocked = !hasMatch && blockTimes.has(slot);
            const status: "free" | "blocked" | "match" = hasMatch
              ? "match"
              : isBlocked
                ? "blocked"
                : "free";

            return (
              <article
                key={`${selectedCourtId}-${selectedDate}-${slot}`}
                className={`rounded-2xl border p-4 shadow-sm ${
                  status === "blocked"
                    ? "border-rose-200 bg-rose-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-lg font-semibold tracking-tight text-slate-900">{slot}</p>
                <p className="mt-1 text-xs text-slate-500">Turno de 90 minutos</p>

                <div className="mt-4">
                  {status === "blocked" ? (
                    <p className="mb-2 text-xs font-semibold text-rose-700">OCUPADO</p>
                  ) : null}

                  <SlotToggleForm
                    courtId={selectedCourtId}
                    date={selectedDate}
                    startTime={slot}
                    status={status}
                  />
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
