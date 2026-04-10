import Link from "next/link";
import { CalendarClock } from "lucide-react";
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

const courtPillBase =
  "rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200";
const courtPillActive =
  "border-sky-200/90 bg-sky-50 text-sky-900 shadow-sm ring-1 ring-sky-200/50";
const courtPillIdle =
  "border-slate-200/80 bg-white text-slate-600 hover:border-sky-200/80 hover:bg-slate-50/90 hover:text-sky-900";

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
    <div className="space-y-6">
      <AdminBackLink />
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
          <CalendarClock size={14} className="text-sky-600" strokeWidth={2} />
          Horarios
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          Configuracion de canchas
        </h1>
        <p className="max-w-lg text-sm font-medium text-slate-500">
          Apertura y cierre por dia de la semana. Cada cancha tiene su propia grilla; los valores se
          guardan al confirmar cada fila.
        </p>
      </header>

      {clubsError || courtsError || schedulesError ? (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 p-4 text-sm font-medium text-rose-800 shadow-sm">
          {clubsError?.message || courtsError?.message || schedulesError?.message}
        </div>
      ) : null}

      {!clubsError && clubs.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-900">No administras ningun club todavia.</p>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Cuando tengas un club asignado, podras editar sus horarios aqui.
          </p>
        </div>
      ) : null}

      {clubs.length > 0 ? (
        <section className="space-y-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cancha</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {courts.map((court) => {
                const isActive = court.id === selectedCourtId;
                return (
                  <Link
                    key={court.id}
                    href={`/club/horarios?court=${court.id}`}
                    className={`${courtPillBase} ${isActive ? courtPillActive : courtPillIdle}`}
                  >
                    {court.name ?? "Cancha"}
                  </Link>
                );
              })}
            </div>
          </div>

          {selectedCourtId ? (
            <ScheduleGrid
              selectedCourtId={selectedCourtId}
              rows={gridRows}
              dayLabels={dayLabels}
            />
          ) : (
            <p className="text-sm font-medium text-slate-500">
              Este club no tiene canchas para configurar horarios.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
