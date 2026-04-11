import { subDays } from "date-fns";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import {
  adminCard,
  adminKicker,
  adminSubtitle,
  adminTitle,
} from "@/components/admin/admin-premium";
import {
  deadHoursSuggestion,
  hourHistogram,
  occupancyPercent,
  theoreticalWeeklyHours,
} from "@/lib/admin/analytics-math";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const since = subDays(new Date(), 7).toISOString();

  const { data: schedulesRaw } =
    ctx.courtIds.length > 0
      ? await supabase
          .from(DB_TABLES.courtSchedules)
          .select("court_id,day_of_week,open_time,close_time")
          .in("court_id", ctx.courtIds)
      : { data: [] };

  const schedules = (schedulesRaw ?? []) as import("@/lib/admin/analytics-math").ScheduleRow[];

  const { data: matchesRaw } =
    ctx.courtIds.length > 0
      ? await supabase
          .from(DB_TABLES.matches)
          .select("date,court_id")
          .in("court_id", ctx.courtIds)
          .gte("date", since)
      : { data: [] };

  const matchesWindow = (matchesRaw ?? []) as { date: string; court_id: string }[];

  const weeklyCap = theoreticalWeeklyHours(schedules);
  const occ = occupancyPercent(schedules, matchesWindow);
  const bins = hourHistogram(matchesWindow);
  const maxBin = Math.max(...bins, 1);
  const dead = deadHoursSuggestion(bins);

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-violet-600`}>Analytics</p>
        <h1 className={adminTitle}>Ocupación y horarios pico</h1>
        <p className={adminSubtitle}>
          Últimos 7 días. Capacidad teórica según{" "}
          <code className="text-xs text-slate-400">court_schedules</code>. Cada partido ~90 min.
        </p>
      </header>

      <section className={adminCard}>
        <h2 className="text-sm font-semibold text-slate-500">Ocupación estimada</h2>
        <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{occ}%</p>
        <p className="mt-2 text-xs font-medium text-slate-500">
          ~{weeklyCap.toFixed(1)} h/semana de franja operativa vs {matchesWindow.length} reservas en
          ventana.
        </p>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/40">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 shadow-sm"
            style={{ width: `${Math.min(100, Math.max(occ, 2))}%` }}
          />
        </div>
      </section>

      <section className={adminCard}>
        <h2 className="text-base font-bold text-slate-900">Mapa de calor (por hora)</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">Inicios de partido por hora local.</p>
        <div className="-mx-2 mt-6 overflow-x-auto pb-2 md:mx-0 md:overflow-visible">
          <div className="flex min-w-max gap-2 px-2 md:grid md:min-w-0 md:grid-cols-6 md:px-0 lg:grid-cols-12">
            {bins.map((count, h) => (
              <div
                key={h}
                className="flex w-[3.25rem] shrink-0 flex-col items-center gap-2 rounded-2xl border border-slate-100/90 bg-slate-50/50 p-3 text-center md:w-auto"
              >
                <div
                  className="h-12 w-full rounded-xl bg-violet-500 shadow-inner shadow-violet-900/10"
                  style={{ opacity: Math.max(0.12, count / maxBin) }}
                  title={`${h}:00 — ${count}`}
                />
                <span className="text-[10px] font-semibold text-slate-500">{h}h</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={adminCard}>
        <h2 className="text-base font-bold text-slate-900">Horas muertas (promos)</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Franjas 7h–22h con menor demanda relativa.
        </p>
        <ul className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {dead.length ? (
            dead.map((h) => (
              <li
                key={h}
                className="inline-flex items-center rounded-full border border-violet-200/60 bg-violet-50/80 px-4 py-2 text-sm font-semibold text-violet-900 ring-1 ring-violet-100"
              >
                {String(h).padStart(2, "0")}:00 – {String(h + 1).padStart(2, "0")}:00
              </li>
            ))
          ) : (
            <li className="text-sm font-medium text-slate-500">Sin datos suficientes.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
