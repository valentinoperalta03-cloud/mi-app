import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { LayoutGrid } from "lucide-react";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
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
  owner_id: string | null;
};

type BlockRow = {
  court_id: string;
  date: string;
  start_time: string;
};

function formatToday() {
  return format(new Date(), "yyyy-MM-dd");
}

const courtPillBase =
  "rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200";
const courtPillActive =
  "border-sky-200/90 bg-sky-50 text-sky-900 shadow-sm ring-1 ring-sky-200/50";
const courtPillIdle =
  "border-slate-200/80 bg-white text-slate-600 hover:border-sky-200/80 hover:bg-slate-50/90 hover:text-sky-900";

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
  const defaultClubId = clubs[0]?.id ?? "";
  const clubIds = clubs.map((club) => club.id);

  const { data: courtsData, error: courtsError } = clubIds.length
    ? await supabase
        .from(DB_TABLES.courts)
        .select("id,name,club_id")
        .in("club_id", clubIds)
        .order("name")
    : { data: [], error: null };

  const courts = (courtsData ?? []) as CourtRow[];
  const fallbackCourtIdForDefaultClub =
    courts.find((court) => court.club_id === defaultClubId)?.id ?? courts[0]?.id ?? "";
  const selectedCourtId =
    params?.court && courts.some((court) => court.id === params.court)
      ? params.court
      : fallbackCourtIdForDefaultClub;

  const dayStartIso = `${selectedDate}T00:00:00`;
  const nextDayIso = format(addDays(new Date(dayStartIso), 1), "yyyy-MM-dd'T'00:00:00");

  const { data: matchesData, error: matchesError } = selectedCourtId
    ? await supabase
        .from(DB_TABLES.matches)
        .select("date,court_id,owner_id")
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

  const creatorIds = Array.from(
    new Set(matches.map((match) => match.owner_id).filter(Boolean))
  ) as string[];
  const { data: profilesData } = creatorIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", creatorIds)
    : { data: [] };
  const creatorNameById = new Map(
    (profilesData ?? []).map((profile) => [
      String((profile as { user_id: string }).user_id),
      (profile as { name: string | null }).name ?? "Jugador",
    ])
  );

  const matchByTime = new Map<string, MatchRow>();
  for (const match of matches) {
    matchByTime.set(format(parseISO(match.date), "HH:mm"), match);
  }
  const blockTimes = new Set(
    blocks.map((b) => (b.start_time.length >= 5 ? b.start_time.slice(0, 5) : b.start_time))
  );

  return (
    <div className="space-y-6">
      <AdminBackLink />
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
          <LayoutGrid size={14} className="text-sky-600" strokeWidth={2} />
          Turnos
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          Gestion de disponibilidad
        </h1>
        <p className="max-w-lg text-sm font-medium text-slate-500">
          Turnos fijos de 90 minutos entre 07:30 y 22:30. Bloquea o libera franjas segun tu operacion
          del dia.
        </p>
      </header>

      {clubsError || courtsError || matchesError || blocksError ? (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 p-4 text-sm font-medium text-rose-800 shadow-sm">
          {clubsError?.message ||
            courtsError?.message ||
            matchesError?.message ||
            blocksError?.message}
        </div>
      ) : null}

      {!clubsError && clubs.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-900">No administras ningun club todavia.</p>
        </div>
      ) : null}

      {clubs.length > 0 ? (
        <section className="space-y-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <label htmlFor="manage-date" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Fecha a gestionar
            </label>
            <form className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="court" value={selectedCourtId} />
              <input
                id="manage-date"
                name="date"
                type="date"
                defaultValue={selectedDate}
                className="rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm outline-none transition-colors focus:border-sky-300 focus:ring-2 focus:ring-sky-200/60"
              />
              <button
                type="submit"
                className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.98]"
              >
                Ver dia
              </button>
            </form>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cancha</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {courts.map((court) => {
                const active = court.id === selectedCourtId;
                return (
                  <Link
                    key={court.id}
                    href={`/club/gestion?court=${court.id}&date=${selectedDate}`}
                    className={`${courtPillBase} ${active ? courtPillActive : courtPillIdle}`}
                  >
                    {court.name ?? "Cancha"}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {selectedCourtId ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SLOT_TIMES.map((slot) => {
            const isBlocked = blockTimes.has(slot);
            const matchAtTime = matchByTime.get(slot);
            const hasMatch = Boolean(matchAtTime);
            const status: "free" | "blocked" | "reserved" = isBlocked
              ? "blocked"
              : hasMatch
                ? "reserved"
                : "free";
            const occupiedBy = isBlocked
              ? "Bloqueo manual"
              : matchAtTime?.owner_id
                ? creatorNameById.get(matchAtTime.owner_id) ?? "Jugador"
                : matchAtTime
                  ? "Jugador"
                  : "";

            const cardClass =
              status === "blocked"
                ? "border-rose-100/90 bg-rose-50/40 shadow-sm"
                : status === "reserved"
                  ? "border-slate-200/80 bg-slate-50/50 shadow-sm"
                  : "border-slate-100 bg-white shadow-sm";

            return (
              <article
                key={`${selectedCourtId}-${selectedDate}-${slot}`}
                className={`rounded-2xl border p-4 transition-shadow hover:shadow-md ${cardClass}`}
              >
                <p className="text-lg font-semibold tracking-tight text-slate-900">{slot}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">Turno de 90 minutos</p>
                {status === "free" ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-700/90">Libre</p>
                ) : null}
                {status !== "free" ? (
                  <p className="mt-2 text-xs font-semibold text-slate-700">Ocupado</p>
                ) : null}
                {status !== "free" ? (
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    {isBlocked ? `Motivo: ${occupiedBy}` : `Jugador: ${occupiedBy}`}
                  </p>
                ) : null}

                <div className="mt-4">
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
    </div>
  );
}
