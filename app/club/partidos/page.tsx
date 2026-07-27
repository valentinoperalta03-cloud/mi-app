import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type ClubRow = {
  id: string;
};

type CourtRow = {
  id: string;
  name: string | null;
  club_id: string;
};

type MatchRow = {
  id: string;
  owner_id: string | null;
  court_id: string;
  date: string;
  is_competitive: boolean | null;
};

type ProfileRow = {
  user_id: string;
  name: string | null;
};

export default async function ClubPartidosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: clubsData, error: clubsError } = await supabase
    .from(DB_TABLES.clubs)
    .select("id")
    .eq("owner_id", user.id);

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
  const courtIds = courts.map((court) => court.id);
  const courtNameById = new Map(courts.map((court) => [court.id, court.name ?? "Cancha"]));

  const { data: matchesData, error: matchesError } = courtIds.length
    ? await supabase
        .from(DB_TABLES.matches)
        .select("id,owner_id,court_id,date,is_competitive")
        .in("court_id", courtIds)
        .order("date", { ascending: false })
    : { data: [], error: null };

  const matches = (matchesData ?? []) as MatchRow[];
  const creatorIds = Array.from(
    new Set(matches.map((match) => match.owner_id).filter(Boolean))
  ) as string[];

  const { data: profilesData, error: profilesError } = creatorIds.length
    ? await supabase
        .from(DB_TABLES.profiles)
        .select("user_id,name")
        .in("user_id", creatorIds)
    : { data: [], error: null };

  const profiles = (profilesData ?? []) as ProfileRow[];
  const creatorNameById = new Map(
    profiles.map((profile) => [profile.user_id, profile.name ?? "Sin nombre"])
  );

  const hasError = clubsError || courtsError || matchesError || profilesError;

  return (
    <main className="space-y-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#0085FC]">Partidos</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          Lista de partidos
        </h1>
        <p className="text-sm text-slate-500">
          Listado de partidos creados en las canchas de tus clubes.
        </p>
      </header>

      {hasError ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {clubsError?.message ||
            courtsError?.message ||
            matchesError?.message ||
            profilesError?.message}
        </section>
      ) : null}

      {!hasError && clubIds.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-medium text-slate-800">No administras ningun club.</p>
        </section>
      ) : null}

      {!hasError && clubIds.length > 0 && matches.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-medium text-slate-800">
            Todavia no hay partidos creados para tus canchas.
          </p>
        </section>
      ) : null}

      {!hasError && matches.length > 0 ? (
        <section className="space-y-3">
          {matches.map((match) => {
            const creatorName = match.owner_id
              ? creatorNameById.get(match.owner_id) ?? "Usuario"
              : "Usuario";
            const courtName = courtNameById.get(match.court_id) ?? "Cancha";
            const when = format(parseISO(match.date), "EEE d MMM yyyy · HH:mm", {
              locale: es,
            });

            return (
              <article
                key={match.id}
                className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm text-slate-500">Creador</p>
                    <p className="text-base font-semibold text-slate-900">{creatorName}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      match.is_competitive
                        ? "border border-[#0085FC]/20 bg-[#0085FC]/5 text-[#0461C4]"
                        : "border border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {match.is_competitive ? "Competitivo" : "Amistoso"}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                  <p>
                    <span className="font-medium text-slate-900">Cancha:</span> {courtName}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Fecha y hora:</span> {when}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">ID Partido:</span> {match.id}
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
