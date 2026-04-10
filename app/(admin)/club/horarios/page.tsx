import Link from "next/link";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import ScheduleGrid from "./schedule-grid";

type ClubRow = {
  id: string;
  name: string | null;
};

type CourtRow = {
  id: string;
  name: string | null;
  club_id: string;
};

type ScheduleRow = {
  court_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
};

type HorariosPageProps = {
  searchParams?: Promise<{
    court?: string;
  }>;
};

const dayLabels = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
];

export default async function ClubHorariosPage({ searchParams }: HorariosPageProps) {
  const supabase = await createClient();
  const params = searchParams ? await searchParams : undefined;

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

  const { data: schedulesData, error: schedulesError } = selectedCourtId
    ? await supabase
        .from(DB_TABLES.courtSchedules)
        .select("court_id,day_of_week,open_time,close_time")
        .eq("court_id", selectedCourtId)
    : { data: [], error: null };

  const schedules = (schedulesData ?? []) as ScheduleRow[];
  const scheduleMap = new Map<number, ScheduleRow>();
  for (const row of schedules) {
    scheduleMap.set(row.day_of_week, row);
  }

  const gridRows: ScheduleRow[] = Array.from({ length: 7 }, (_, day) => {
    const row = scheduleMap.get(day);
    return {
      court_id: selectedCourtId,
      day_of_week: day,
      open_time: row?.open_time ?? null,
      close_time: row?.close_time ?? null,
    };
  });

  return (
    <main className="space-y-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Canchas</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          Horarios de canchas
        </h1>
        <p className="text-sm text-slate-500">
          Configura apertura y cierre por dia para cada cancha del club.
        </p>
      </header>

      {clubsError || courtsError || schedulesError ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {clubsError?.message || courtsError?.message || schedulesError?.message}
        </section>
      ) : null}

      {!clubsError && clubs.length === 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
          <p className="text-base font-medium text-slate-800">
            No administras ningun club todavia.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Cuando tengas un club asignado, podras editar sus horarios aqui.
          </p>
        </section>
      ) : null}

      {clubs.length > 0 ? (
        <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end gap-2">
            {courts.map((court) => {
              const isActive = court.id === selectedCourtId;
              return (
                <Link
                  key={court.id}
                  href={`/club/horarios?court=${court.id}`}
                  className={`rounded-2xl border px-4 py-2 text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? "border-sky-500 bg-sky-500 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:text-sky-700"
                  }`}
                >
                  {court.name ?? "Cancha"}
                </Link>
              );
            })}
          </div>

          {selectedCourtId ? (
            <ScheduleGrid
              selectedCourtId={selectedCourtId}
              rows={gridRows}
              dayLabels={dayLabels}
            />
          ) : (
            <p className="text-sm text-slate-500">
              Este club no tiene canchas para configurar horarios.
            </p>
          )}
        </section>
      ) : null}
    </main>
  );
}
