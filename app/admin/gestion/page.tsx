import { supabase } from "@/lib/supabase";
import { CreateCourtForm, ScheduleForm } from "./feedback";

type ClubRow = {
  id: string;
  name: string | null;
  location: string | null;
};

type CourtRow = {
  id: string;
  club_id: string;
  name: string | null;
  price: number | null;
};

type ScheduleRow = {
  court_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
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

export default async function AdminGestionPage() {
  const { data: clubsData, error: clubsError } = await supabase
    .from("clubs")
    .select("id,name,location")
    .order("name");

  const clubs = (clubsData ?? []) as ClubRow[];
  const clubIds = clubs.map((club) => club.id);

  const { data: courtsData, error: courtsError } = clubIds.length
    ? await supabase
        .from("courts")
        .select("id,club_id,name,price")
        .in("club_id", clubIds)
        .order("name")
    : { data: [], error: null };

  const courts = (courtsData ?? []) as CourtRow[];
  const courtIds = courts.map((court) => court.id);

  const { data: schedulesData, error: schedulesError } = courtIds.length
    ? await supabase
        .from("court_schedules")
        .select("court_id,day_of_week,open_time,close_time")
        .in("court_id", courtIds)
    : { data: [], error: null };

  const schedules = (schedulesData ?? []) as ScheduleRow[];

  const courtsByClub = new Map<string, CourtRow[]>();
  for (const court of courts) {
    const list = courtsByClub.get(court.club_id) ?? [];
    list.push(court);
    courtsByClub.set(court.club_id, list);
  }

  const scheduleByCourtAndDay = new Map<string, ScheduleRow>();
  for (const schedule of schedules) {
    scheduleByCourtAndDay.set(
      `${schedule.court_id}-${schedule.day_of_week}`,
      schedule
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-white px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Gestion de Clubes</h1>
        <p className="text-sm text-slate-500">
          Administra canchas y horarios semanales.
        </p>
      </header>

      {clubsError || courtsError || schedulesError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {clubsError?.message || courtsError?.message || schedulesError?.message}
        </div>
      ) : null}

      <section className="space-y-4">
        {clubs.map((club) => {
          const clubCourts = courtsByClub.get(club.id) ?? [];

          return (
            <article
              key={club.id}
              className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {club.name ?? "Club sin nombre"}
                </h2>
                <p className="text-sm text-slate-500">{club.location ?? "Sin ubicacion"}</p>
              </div>

              <CreateCourtForm clubId={club.id} />

              <div className="space-y-3">
                {clubCourts.length ? (
                  clubCourts.map((court) => (
                    <div
                      key={court.id}
                      className="space-y-3 rounded-2xl border border-gray-100 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-900">
                          {court.name ?? "Cancha sin nombre"}
                        </p>
                        <span className="text-sm text-slate-500">
                          ${court.price ?? 0}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {dayLabels.map((dayLabel, dayIndex) => {
                          const current = scheduleByCourtAndDay.get(
                            `${court.id}-${dayIndex}`
                          );

                          return (
                            <div key={`${court.id}-${dayIndex}`} className="space-y-1">
                              <p className="text-xs font-medium text-slate-500">
                                {dayLabel}
                              </p>
                              <ScheduleForm
                                courtId={court.id}
                                dayOfWeek={dayIndex}
                                openTime={current?.open_time}
                                closeTime={current?.close_time}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Este club aun no tiene canchas.
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
