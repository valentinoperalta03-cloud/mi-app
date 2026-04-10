import Link from "next/link";
import { format, parseISO } from "date-fns";
import { redirect } from "next/navigation";
import { Calendar, Users } from "lucide-react";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type ClubRow = { id: string; name: string | null };
type CourtRow = { id: string; name: string | null; club_id: string };
type MatchRow = {
  id: string;
  court_id: string;
  created_by: string | null;
  date: string;
  is_competitive: boolean | null;
};
type ProfileRow = { user_id: string; name: string | null };

const quickLinks = [
  { href: "/club/gestion", label: "Gestión del club" },
  { href: "/club/horarios", label: "Canchas" },
  { href: "/club/partidos", label: "Partidos" },
  { href: "/admin/control", label: "Panel de Control" },
];

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: clubsData } = await supabase
    .from(DB_TABLES.clubs)
    .select("id,name")
    .eq("owner_id", user.id)
    .order("name");
  const clubs = (clubsData ?? []) as ClubRow[];
  const clubIds = clubs.map((club) => club.id);

  const { data: courtsData } = clubIds.length
    ? await supabase
        .from(DB_TABLES.courts)
        .select("id,name,club_id")
        .in("club_id", clubIds)
    : { data: [] };
  const courts = (courtsData ?? []) as CourtRow[];
  const courtIds = courts.map((court) => court.id);
  const courtNameById = new Map(courts.map((court) => [court.id, court.name ?? "Cancha"]));

  const { data: matchesData } = courtIds.length
    ? await supabase
        .from(DB_TABLES.matches)
        .select("id,court_id,created_by,date,is_competitive")
        .in("court_id", courtIds)
        .order("date", { ascending: false })
    : { data: [] };
  const matches = (matchesData ?? []) as MatchRow[];

  const creatorIds = Array.from(
    new Set(matches.map((match) => match.created_by).filter(Boolean))
  ) as string[];
  const { data: profilesData } = creatorIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", creatorIds)
    : { data: [] };
  const profiles = (profilesData ?? []) as ProfileRow[];
  const profileNameById = new Map(
    profiles.map((profile) => [profile.user_id, profile.name ?? "Jugador"])
  );

  const uniquePlayers = new Set(creatorIds).size;
  const reservationsByPlayer = new Map<string, number>();
  for (const match of matches) {
    if (!match.created_by) continue;
    reservationsByPlayer.set(
      match.created_by,
      (reservationsByPlayer.get(match.created_by) ?? 0) + 1
    );
  }
  const playerRows = Array.from(reservationsByPlayer.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([userId, count]) => ({
      userId,
      name: profileNameById.get(userId) ?? "Jugador",
      count,
    }));

  const reservationRows = matches.map((match) => ({
    key: `match-${match.id}`,
    when: format(parseISO(match.date), "yyyy-MM-dd HH:mm"),
    player: match.created_by ? profileNameById.get(match.created_by) ?? "Jugador" : "Jugador",
    court: courtNameById.get(match.court_id) ?? "Cancha",
    isCompetitive: Boolean(match.is_competitive),
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-sky-600">Portal Administrador</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Dashboard del club</h2>
        <p className="mt-2 text-sm text-slate-600">
          Vista operativa con reservas y actividad de jugadores.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-sky-600" />
            <h3 className="text-base font-semibold text-slate-900">Reservas</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Reservas reales desde `matches` con jugador, cancha y horario.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="py-2 pr-3 font-medium">Fecha/Hora</th>
                  <th className="py-2 pr-3 font-medium">Cancha</th>
                  <th className="py-2 pr-3 font-medium">Jugador</th>
                  <th className="py-2 font-medium">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {reservationRows.slice(0, 30).map((event) => (
                  <tr key={event.key} className="border-b border-slate-50">
                    <td className="py-2 pr-3 text-slate-700">{event.when}</td>
                    <td className="py-2 pr-3 text-slate-700">{event.court}</td>
                    <td className="py-2 pr-3 text-slate-700">{event.player}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          event.isCompetitive
                            ? "bg-sky-100 text-sky-700"
                            : "bg-indigo-100 text-indigo-700"
                        }`}
                      >
                        {event.isCompetitive ? "Competitivo" : "Amistoso"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-sky-600" />
            <h3 className="text-base font-semibold text-slate-900">Jugadores</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Usuarios únicos por `matches.created_by` y frecuencia de reservas.
          </p>
          <p className="mt-3 text-sm text-slate-700">Jugadores únicos: {uniquePlayers}</p>
          <div className="mt-3 space-y-2">
            {playerRows.length === 0 ? (
              <p className="text-sm text-slate-500">No hay jugadores registrados todavía.</p>
            ) : (
              playerRows.slice(0, 8).map((player) => (
                <div
                  key={player.userId}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2"
                >
                  <span className="text-sm font-medium text-slate-800">{player.name}</span>
                  <span className="text-xs font-semibold text-sky-700">
                    {player.count} reserva(s)
                  </span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
