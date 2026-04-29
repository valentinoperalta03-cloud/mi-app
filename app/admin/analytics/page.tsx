import { endOfMonth, format, startOfMonth, subDays } from "date-fns";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const prevStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const prevEnd = endOfMonth(prevStart);
  const since30 = subDays(now, 30);

  const reservationQuery = () =>
    supabase
      .from(DB_TABLES.matches)
      .select("id,court_id,owner_id,total_price,scheduled_date,scheduled_time")
      .in("court_id", ctx.courtIds)
      .eq("match_type", "reservation")
      .eq("match_status", "reserved");

  const [{ data: monthRows }, { data: prevRows }, { data: last30Rows }, { data: schedulesRaw }] = await Promise.all([
    reservationQuery().gte("scheduled_date", format(monthStart, "yyyy-MM-dd")).lte("scheduled_date", format(monthEnd, "yyyy-MM-dd")),
    reservationQuery().gte("scheduled_date", format(prevStart, "yyyy-MM-dd")).lte("scheduled_date", format(prevEnd, "yyyy-MM-dd")),
    reservationQuery().gte("scheduled_date", format(since30, "yyyy-MM-dd")),
    ctx.courtIds.length > 0
      ? await supabase
          .from(DB_TABLES.courtSchedules)
          .select("court_id,day_of_week,open_time,close_time")
          .in("court_id", ctx.courtIds)
      : { data: [] },
  ]);

  const monthMatches = (monthRows ?? []) as Array<{
    id: string;
    court_id: string;
    owner_id: string | null;
    total_price: number | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
  }>;
  const prevMatches = (prevRows ?? []) as typeof monthMatches;
  const last30Matches = (last30Rows ?? []) as typeof monthMatches;
  const schedules = (schedulesRaw ?? []) as Array<{
    court_id: string;
    day_of_week: number | null;
    open_time: string | null;
    close_time: string | null;
  }>;

  const sumMoney = (rows: typeof monthMatches) => rows.reduce((acc, r) => acc + Number(r.total_price ?? 0), 0);
  const currentRevenue = sumMoney(monthMatches);
  const previousRevenue = sumMoney(prevMatches);

  const countByCourt = new Map<string, number>();
  for (const row of monthMatches) {
    countByCourt.set(row.court_id, (countByCourt.get(row.court_id) ?? 0) + 1);
  }
  const topCourt = [...countByCourt.entries()].sort((a, b) => b[1] - a[1])[0];
  const courtNameById = new Map(ctx.courts.map((c) => [c.id, c.name ?? "Cancha"]));

  const hours = new Map<string, number>();
  for (const row of last30Matches) {
    const hh = String(row.scheduled_time ?? "").trim().slice(0, 2);
    if (!hh) continue;
    const key = `${hh}:00`;
    hours.set(key, (hours.get(key) ?? 0) + 1);
  }
  const peakHour = [...hours.entries()].sort((a, b) => b[1] - a[1])[0];

  const scheduleByCourtDay = new Map<string, { open: string; close: string }>();
  for (const s of schedules) {
    if (s.day_of_week == null || !s.open_time || !s.close_time) continue;
    scheduleByCourtDay.set(`${s.court_id}__${s.day_of_week}`, { open: s.open_time, close: s.close_time });
  }
  const reservationsByCourt = new Map<string, number>();
  for (const row of last30Matches) {
    reservationsByCourt.set(row.court_id, (reservationsByCourt.get(row.court_id) ?? 0) + 1);
  }
  const availableSlotsByCourt = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = subDays(now, i);
    const day = d.getDay();
    for (const court of ctx.courts) {
      const schedule = scheduleByCourtDay.get(`${court.id}__${day}`);
      if (!schedule) continue;
      const openMin = Number(schedule.open.slice(0, 2)) * 60 + Number(schedule.open.slice(3, 5));
      const closeMin = Number(schedule.close.slice(0, 2)) * 60 + Number(schedule.close.slice(3, 5));
      const slots = Math.max(0, Math.floor((closeMin - openMin) / 60));
      availableSlotsByCourt.set(court.id, (availableSlotsByCourt.get(court.id) ?? 0) + slots);
    }
  }
  const uniquePlayers = new Set(monthMatches.map((m) => m.owner_id).filter((id): id is string => Boolean(id))).size;

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-violet-600`}>Analytics</p>
        <h1 className={adminTitle}>Estadísticas del club</h1>
        <p className={adminSubtitle}>KPIs clave de reservas, ingresos y ocupación.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className={adminCard}>
          <p className={adminKicker}>Ingresos del mes</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">${currentRevenue.toFixed(2)}</p>
          <p className="text-sm font-medium text-slate-500">Mes anterior: ${previousRevenue.toFixed(2)}</p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Jugadores únicos (mes)</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{uniquePlayers}</p>
        </div>
      </section>

      <section className={adminCard}>
        <h2 className="text-base font-bold text-slate-900">Cancha más reservada</h2>
        <p className="mt-2 text-lg font-semibold text-slate-800">
          {topCourt ? `${courtNameById.get(topCourt[0]) ?? "Cancha"} (${topCourt[1]} reservas)` : "Sin datos"}
        </p>
        <h2 className="mt-5 text-base font-bold text-slate-900">Hora pico (últimos 30 días)</h2>
        <p className="mt-2 text-lg font-semibold text-slate-800">
          {peakHour ? `${peakHour[0]} (${peakHour[1]} reservas)` : "Sin datos"}
        </p>
      </section>

      <section className={adminCard}>
        <h2 className="text-base font-bold text-slate-900">Tasa de ocupación por cancha</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {ctx.courts.map((court) => {
            const reservations = reservationsByCourt.get(court.id) ?? 0;
            const slots = availableSlotsByCourt.get(court.id) ?? 0;
            const ratio = slots > 0 ? Math.round((reservations / slots) * 100) : 0;
            return (
              <li key={court.id} className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{court.name ?? "Cancha"}</span>
                  <span className="font-bold text-slate-900">{ratio}%</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {reservations} reservas / {slots} slots disponibles
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
