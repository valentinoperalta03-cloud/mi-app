import { addDays, format, isTomorrow, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, CalendarDays, DollarSign, LayoutGrid, Target, Users } from "lucide-react";
import { adminCard, adminKicker, adminPressable, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { formatLongDateInArgentina, getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

const quickActions = [
  { href: "/admin/reservas", label: "Reservas" },
  { href: "/admin/finanzas", label: "Finanzas" },
  { href: "/admin/canchas", label: "Canchas" },
  { href: "/admin/club", label: "Info del club" },
] as const;

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const today = getTodayYmdInArgentina();
  const todayLong = formatLongDateInArgentina();
  const tomorrow = format(addDays(new Date(`${today}T12:00:00`), 1), "yyyy-MM-dd");
  const weekEnd = format(addDays(new Date(`${today}T12:00:00`), 6), "yyyy-MM-dd");

  const { data: todayMatches } = ctx.courtIds.length > 0
    ? await supabase
        .from(DB_TABLES.matches)
        .select("id,court_id,owner_id,total_price,payment_status,scheduled_time,scheduled_date,duration_minutes")
        .in("court_id", ctx.courtIds)
        .eq("scheduled_date", today)
        .eq("match_type", "reservation")
        .eq("match_status", "reserved")
    : { data: [] };

  const todayRows = (todayMatches ?? []) as Array<{
    id: string; court_id: string; owner_id: string | null; total_price: number | null;
    payment_status: string | null; scheduled_time: string | null; scheduled_date: string | null; duration_minutes: number | null;
  }>;

  const reservasHoy = todayRows.length;
  const ingresosEstimados = todayRows
    .filter((r) => String(r.payment_status ?? "").toLowerCase() === "paid")
    .reduce((sum, r) => sum + (r.total_price ?? 0), 0);
  const canchasOcupadas = new Set(todayRows.map((r) => r.court_id)).size;
  const ocupacionPct = ctx.courtIds.length > 0 ? Math.round((canchasOcupadas / ctx.courtIds.length) * 100) : 0;
  const jugadoresActivos = new Set(todayRows.map((r) => r.owner_id).filter((id): id is string => Boolean(id)))
    .size;

  const bucketsByHour = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0 }));
  for (const row of todayRows) {
    const raw = String(row.scheduled_time ?? "").trim();
    if (!raw) continue;
    const hour = Number(raw.slice(0, 2));
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    bucketsByHour[hour].total += 1;
  }
  const hourlyBars = bucketsByHour.filter((b) => b.total > 0);
  const chartData = hourlyBars.length > 0 ? hourlyBars : bucketsByHour.slice(8, 23);
  const maxHourly = Math.max(1, ...chartData.map((b) => b.total));

  const todayMetrics = [
    {
      label: "Reservas de Hoy",
      value: String(reservasHoy),
      icon: Target,
      color: "text-[#0461C4]",
      topBorder: "#0585FC",
    },
    {
      label: "Ingresos Estimados",
      value: money.format(ingresosEstimados),
      icon: DollarSign,
      color: "text-emerald-700",
      topBorder: "#22c55e",
    },
    {
      label: "Ocupación de Canchas (%)",
      value: `${ocupacionPct}%`,
      icon: Activity,
      color: "text-violet-700",
      topBorder: "#8b5cf6",
    },
    {
      label: "Jugadores Activos",
      value: String(jugadoresActivos),
      icon: Users,
      color: "text-amber-700",
      topBorder: "#f59e0b",
    },
  ] as const;

  const { data: weekRaw } = ctx.courtIds.length > 0
    ? await supabase
        .from(DB_TABLES.matches)
        .select("id,scheduled_date,total_price,payment_status")
        .in("court_id", ctx.courtIds)
        .eq("match_type", "reservation")
        .eq("match_status", "reserved")
        .gte("scheduled_date", today)
        .lte("scheduled_date", weekEnd)
    : { data: [] };

  const weekRows = (weekRaw ?? []) as Array<{
    id: string; scheduled_date: string | null; total_price: number | null; payment_status: string | null;
  }>;
  const weekRevenue = weekRows
    .filter((r) => String(r.payment_status ?? "").toLowerCase() === "paid")
    .reduce((acc, r) => acc + Number(r.total_price ?? 0), 0);
  const byDay = new Map<string, number>();
  for (const row of weekRows) {
    const d = row.scheduled_date;
    if (!d) continue;
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const busiestDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];

  const { data: upcomingRaw } = ctx.courtIds.length > 0
    ? await supabase
        .from(DB_TABLES.matches)
        .select("id,owner_id,payment_status,scheduled_date,scheduled_time,court_id")
        .in("court_id", ctx.courtIds)
        .eq("match_type", "reservation")
        .eq("match_status", "reserved")
        .gte("scheduled_date", today)
        .lte("scheduled_date", tomorrow)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true })
        .limit(12)
    : { data: [] };

  const upcomingRows = (upcomingRaw ?? []) as Array<{
    id: string; owner_id: string | null; payment_status: string | null; scheduled_date: string | null; scheduled_time: string | null; court_id: string;
  }>;
  const ownerIds = Array.from(new Set(upcomingRows.map((r) => r.owner_id).filter((v): v is string => Boolean(v))));
  const { data: profilesData } = ownerIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", ownerIds)
    : { data: [] };
  const profileNameById = new Map((profilesData ?? []).map((p: { user_id: string; name: string | null }) => [p.user_id, p.name ?? "Jugador"]));

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const occupiedCourtsNow = new Set<string>();
  for (const row of todayRows) {
    const t = String(row.scheduled_time ?? "").trim();
    if (!/^\d{2}:\d{2}/.test(t)) continue;
    const startMinutes = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    if (Math.abs(startMinutes - nowMinutes) <= 30) {
      occupiedCourtsNow.add(row.court_id);
    }
  }

  if (ctx.clubIds.length === 0) {
    return (
      <div className={`${adminCard} border-amber-200/80 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/40`}>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Sin club asignado</h1>
        <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          No encontramos un club donde seas titular. Si acabas de configurar tu cuenta, revisa
          permisos en la base o contacta soporte.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className={`${adminCard} relative overflow-hidden`}>
        <div className="absolute -right-12 -top-10 h-40 w-40 rounded-full bg-[#0585FC]/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
              <CalendarDays size={15} className="text-[#0585FC]" strokeWidth={2.25} />
              {todayLong}
            </div>
            <h1 className={adminTitle}>Panel de administración</h1>
            <p className={`${adminSubtitle} max-w-xl`}>
              Seguimiento diario de reservas, ingresos y ocupación del club en tiempo real.
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-[#0585FC]/20 bg-[#0585FC]/5 px-3 py-1 text-xs font-semibold text-[#0461C4]">
            {ctx.clubs[0]?.name ?? "Mi club"}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {todayMetrics.map(({ label, value, icon: Icon, color, topBorder }) => (
          <div
            key={label}
            className={`${adminCard} flex flex-col gap-2 border-t-2 p-4`}
            style={{ borderTopColor: topBorder }}
          >
            <Icon size={18} className={color} strokeWidth={2} />
            <p className={adminKicker}>{label}</p>
            <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
            {label.includes("Ocupación") ? (
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0585FC] to-cyan-400"
                  style={{ width: `${ocupacionPct}%` }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className={`${adminCard} border-[#0585FC]/20 bg-[#0585FC]/5`}>
          <p className={adminKicker}>Esta semana</p>
          <p className="mt-2 text-2xl font-bold text-[#0461C4]">{weekRows.length}</p>
          <p className="text-xs font-medium text-slate-500">Total de reservas</p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Ingresos estimados (paid)</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{money.format(weekRevenue)}</p>
          <p className="text-xs font-medium text-slate-500">Próximos 7 días</p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Día más ocupado</p>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {busiestDay ? format(parseISO(`${busiestDay[0]}T12:00:00`), "EEE d MMM", { locale: es }) : "Sin datos"}
          </p>
          <p className="text-xs font-medium text-slate-500">
            {busiestDay ? `${busiestDay[1]} reservas` : "No hay reservas cargadas"}
          </p>
        </div>
      </section>

      <section className={`${adminCard} p-5`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className={`${adminKicker} text-slate-500`}>Actividad del día</p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Horas pico del día</h2>
          </div>
          <p className="text-sm font-semibold text-slate-500">
            Total: <span className="text-slate-800">{reservasHoy}</span>
          </p>
        </div>
        <div className="space-y-3">
          {chartData.map((item) => (
            <div key={item.hour} className="grid grid-cols-[44px_1fr_36px] items-center gap-3">
              <p className="text-[11px] font-semibold text-slate-500">{String(item.hour).padStart(2, "0")}:00</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0585FC] to-cyan-400"
                  style={{ width: `${Math.max(6, (item.total / maxHourly) * 100)}%` }}
                  title={`${item.total} reservas`}
                />
              </div>
              <p className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">{item.total}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`${adminCard} p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className={adminKicker}>Agenda</p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Próximas reservas</h2>
          </div>
          <Link href="/admin/reservas" className="text-sm font-semibold text-[#0585FC]">
            Ver todas →
          </Link>
        </div>

        {upcomingRows.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No hay reservas entre hoy y mañana</p>
        ) : (
          <ul className="space-y-3">
            {upcomingRows.slice(0, 8).map((row) => {
              const time = String(row.scheduled_time ?? "").slice(0, 5) || "--:--";
              const isPaid = String(row.payment_status ?? "").toLowerCase() === "paid";
              const dateLabel = row.scheduled_date
                ? (() => {
                    const date = parseISO(`${row.scheduled_date}T12:00:00`);
                    if (isToday(date)) return "Hoy";
                    if (isTomorrow(date)) return "Mañana";
                    return format(date, "EEE d MMM", { locale: es });
                  })()
                : "Sin fecha";
              return (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0585FC]/10 text-sm font-bold text-[#0585FC]">
                      {time}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {profileNameById.get(row.owner_id ?? "") ?? "Jugador"}
                      </p>
                      <p className="text-xs text-slate-500">{dateLabel} · {time} hs</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      isPaid
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-400"
                        : "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80 dark:bg-amber-950/50 dark:text-amber-400"
                    }`}
                  >
                    {isPaid ? "Pagado" : "Pendiente"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={adminCard}>
        <div className="mb-4 flex items-center gap-2">
          <LayoutGrid size={16} className="text-[#0585FC]" />
          <h2 className="text-base font-bold text-slate-900">Canchas libres ahora</h2>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ctx.courts.map((court) => {
            const isOccupied = occupiedCourtsNow.has(court.id);
            return (
              <li key={court.id} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-sm">
                <span className="font-semibold text-slate-800">{court.name ?? "Cancha"}</span>
                <span className={isOccupied ? "font-semibold text-rose-700" : "font-semibold text-emerald-700"}>
                  {isOccupied ? "Ocupada" : "Libre"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={adminCard}>
        <p className={adminKicker}>Accesos rápidos</p>
        <div className="mt-4 flex flex-col gap-3 text-sm font-semibold sm:flex-row sm:flex-wrap sm:gap-x-6">
          {quickActions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-[#0585FC] hover:text-[#0585FC] ${adminPressable} inline-flex w-fit rounded-full px-1 py-0.5`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
