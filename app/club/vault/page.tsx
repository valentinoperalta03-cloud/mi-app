import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { DollarSign, Users } from "lucide-react";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type ClubRow = { id: string };
type CourtRow = { id: string; price: number | null };
type MatchRow = { court_id: string; date: string; owner_id: string | null };
type ProfileRow = { user_id: string; name: string | null };

async function closeAdminSessionAction() {
  "use server";
  const cookieStore = await cookies();
  cookieStore.delete("admin_control_access");
  redirect("/club/gestion");
}

export default async function OwnerVaultPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const hasAccess = cookieStore.get("admin_control_access")?.value === "granted";
  if (!hasAccess) {
    redirect("/admin/control");
  }

  const { data: clubsData } = await supabase
    .from(DB_TABLES.clubs)
    .select("id")
    .eq("owner_id", user.id);
  const clubs = (clubsData ?? []) as ClubRow[];
  const clubIds = clubs.map((club) => club.id);

  const { data: courtsData } = clubIds.length
    ? await supabase.from(DB_TABLES.courts).select("id,price").in("club_id", clubIds)
    : { data: [] };
  const courts = (courtsData ?? []) as CourtRow[];
  const courtIds = courts.map((court) => court.id);
  const courtPriceById = new Map(courts.map((court) => [court.id, court.price ?? 0]));

  const { data: matchesData } = courtIds.length
    ? await supabase
        .from(DB_TABLES.matches)
        .select("court_id,date,owner_id")
        .in("court_id", courtIds)
        .order("date", { ascending: false })
    : { data: [] };
  const matches = (matchesData ?? []) as MatchRow[];

  const now = new Date();
  const playedMatches = matches.filter((match) => parseISO(match.date) < now);
  const totalIncome = playedMatches.reduce(
    (sum, match) => sum + (courtPriceById.get(match.court_id) ?? 0),
    0
  );

  const incomeByDay = new Map<string, number>();
  for (const match of playedMatches) {
    const day = format(parseISO(match.date), "yyyy-MM-dd");
    incomeByDay.set(day, (incomeByDay.get(day) ?? 0) + (courtPriceById.get(match.court_id) ?? 0));
  }
  const bars = Array.from(incomeByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7);
  const maxBar = bars.reduce((max, [, value]) => Math.max(max, value), 0);

  const creatorIds = Array.from(
    new Set(matches.map((match) => match.owner_id).filter(Boolean))
  ) as string[];
  const { data: profilesData } = creatorIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", creatorIds)
    : { data: [] };
  const profileById = new Map(
    ((profilesData ?? []) as ProfileRow[]).map((profile) => [
      profile.user_id,
      profile.name ?? "Jugador",
    ])
  );

  const frequencyByPlayer = new Map<string, number>();
  for (const match of matches) {
    if (!match.owner_id) continue;
    frequencyByPlayer.set(
      match.owner_id,
      (frequencyByPlayer.get(match.owner_id) ?? 0) + 1
    );
  }
  const recurrentPlayers = Array.from(frequencyByPlayer.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([userId, count]) => ({
      userId,
      name: profileById.get(userId) ?? "Jugador",
      count,
    }));

  return (
    <main className="space-y-6">
      <AdminBackLink href="/admin/dashboard" label="Volver al panel" />
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-[#0585FC]">Boveda del Dueno</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Ingresos y jugadores clave</h1>
        <p className="mt-2 text-sm text-slate-500">
          Informacion financiera y de comportamiento del club.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-900">Ingresos</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">Suma de `courts.price` en partidos jugados.</p>
          <p className="mt-4 text-3xl font-semibold text-emerald-700">${totalIncome.toFixed(2)}</p>

          <div className="mt-4 space-y-2">
            {bars.length === 0 ? (
              <p className="text-sm text-slate-500">Aun no hay ingresos registrados.</p>
            ) : (
              bars.map(([day, value]) => {
                const width = maxBar > 0 ? (value / maxBar) * 100 : 0;
                return (
                  <div key={day} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{format(parseISO(`${day}T00:00:00`), "EEE d MMM", { locale: es })}</span>
                      <span>${value.toFixed(2)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                        style={{ width: `${Math.max(width, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#0585FC]" />
            <h2 className="text-base font-semibold text-slate-900">Jugadores recurrentes</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">Frecuencia de reservas por `matches.owner_id`.</p>
          <div className="mt-4 space-y-2">
            {recurrentPlayers.length === 0 ? (
              <p className="text-sm text-slate-500">No hay reservas registradas aun.</p>
            ) : (
              recurrentPlayers.slice(0, 12).map((player) => (
                <div
                  key={player.userId}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2"
                >
                  <span className="text-sm font-medium text-slate-800">{player.name}</span>
                  <span className="text-xs font-semibold text-[#0461C4]">
                    {player.count} reserva(s)
                  </span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <form action={closeAdminSessionAction}>
        <button
          type="submit"
          className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700"
        >
          Cerrar Sesion de Admin
        </button>
      </form>
    </main>
  );
}
