import Link from "next/link";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { DB_TABLES } from "@/lib/db-tables";
import { requireSuperadminAction } from "@/lib/superadmin/guards";

function money(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

export default async function SuperadminDashboardPage() {
  const { svc } = await requireSuperadminAction();

  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const sixMonthsAgo = format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");

  const [
    { count: clubsActive },
    { count: playersTotal },
    { count: reservasAll },
    { count: reservasMonth },
    paidMatches,
    debtsPending,
    reservasByMonth,
    matchesThisMonth,
    courtsRows,
    clubsRows,
    debtsAgg,
    clubsIdle,
    blockedWeek,
  ] = await Promise.all([
    svc.from(DB_TABLES.clubs).select("id", { count: "exact", head: true }).eq("is_active", true),
    svc.from(DB_TABLES.profiles).select("user_id", { count: "exact", head: true }),
    svc
      .from(DB_TABLES.matches)
      .select("id", { count: "exact", head: true })
      .eq("match_type", "reservation")
      .neq("match_status", "cancelled"),
    svc
      .from(DB_TABLES.matches)
      .select("id", { count: "exact", head: true })
      .eq("match_type", "reservation")
      .neq("match_status", "cancelled")
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd),
    svc
      .from(DB_TABLES.matches)
      .select("total_price")
      .eq("match_type", "reservation")
      .eq("payment_status", "paid")
      .neq("match_status", "cancelled"),
    svc.from(DB_TABLES.clubDebts).select("amount").eq("status", "pending"),
    svc
      .from(DB_TABLES.matches)
      .select("scheduled_date")
      .eq("match_type", "reservation")
      .neq("match_status", "cancelled")
      .gte("scheduled_date", sixMonthsAgo),
    svc
      .from(DB_TABLES.matches)
      .select("id,court_id,scheduled_date")
      .eq("match_type", "reservation")
      .neq("match_status", "cancelled")
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd),
    svc.from(DB_TABLES.courts).select("id,club_id"),
    svc.from(DB_TABLES.clubs).select("id,name,is_active"),
    svc.from(DB_TABLES.clubDebts).select("club_id,amount").eq("status", "pending"),
    svc.from(DB_TABLES.clubs).select("id,name,created_at").eq("is_active", true),
    svc
      .from(DB_TABLES.blockedUsers)
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
  ]);

  const ingresosPagados =
    (paidMatches.data ?? []).reduce((a, r) => a + Number((r as { total_price: number | null }).total_price ?? 0), 0) ||
    0;

  const deudaTotal = (debtsPending.data ?? []).reduce(
    (a, r) => a + Number((r as { amount: number | null }).amount ?? 0),
    0
  );

  const byMonth = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = startOfMonth(subMonths(new Date(), i));
    byMonth.set(format(d, "yyyy-MM"), 0);
  }
  for (const row of reservasByMonth.data ?? []) {
    const sd = String((row as { scheduled_date: string | null }).scheduled_date ?? "").slice(0, 7);
    if (byMonth.has(sd)) byMonth.set(sd, (byMonth.get(sd) ?? 0) + 1);
  }
  const chartBars = [...byMonth.entries()].map(([ym, c]) => ({
    label: format(new Date(`${ym}-15`), "MMM", { locale: es }),
    count: c,
    ym,
  }));
  const maxBar = Math.max(1, ...chartBars.map((b) => b.count));

  const courtToClub = new Map(
    ((courtsRows.data ?? []) as Array<{ id: string; club_id: string }>).map((c) => [c.id, c.club_id])
  );
  const clubName = new Map(
    ((clubsRows.data ?? []) as Array<{ id: string; name: string | null }>).map((c) => [c.id, c.name ?? "Club"])
  );
  const resCountByClub = new Map<string, number>();
  for (const m of (matchesThisMonth.data ?? []) as Array<{ court_id: string }>) {
    const cid = courtToClub.get(m.court_id);
    if (!cid) continue;
    resCountByClub.set(cid, (resCountByClub.get(cid) ?? 0) + 1);
  }
  const topClubs = [...resCountByClub.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n]) => ({ id, name: clubName.get(id) ?? "Club", count: n }));

  const debtByClub = new Map<string, number>();
  for (const d of (debtsAgg.data ?? []) as Array<{ club_id: string; amount: number | null }>) {
    debtByClub.set(d.club_id, (debtByClub.get(d.club_id) ?? 0) + Number(d.amount ?? 0));
  }
  const debtAlerts = [...debtByClub.entries()].filter(([, v]) => v > 50_000);

  const lastActivity = new Map<string, string>();
  const { data: lastMatches } = await svc
    .from(DB_TABLES.matches)
    .select("court_id,scheduled_date")
    .eq("match_type", "reservation")
    .neq("match_status", "cancelled")
    .order("scheduled_date", { ascending: false })
    .limit(5000);
  for (const m of lastMatches ?? []) {
    const row = m as { court_id: string; scheduled_date: string | null };
    const clubId = courtToClub.get(row.court_id);
    if (!clubId || lastActivity.has(clubId)) continue;
    if (row.scheduled_date) lastActivity.set(clubId, row.scheduled_date);
  }
  const weekAgoYmd = format(new Date(Date.now() - 7 * 24 * 3600 * 1000), "yyyy-MM-dd");
  const idleClubs = ((clubsIdle.data ?? []) as Array<{ id: string; name: string | null }>).filter((c) => {
    const last = lastActivity.get(c.id);
    if (!last) return true;
    return last < weekAgoYmd;
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard global</h1>
          <p className="mt-1 text-sm text-slate-400">Métricas en tiempo real de la plataforma.</p>
        </div>
        <Link
          href="/superadmin/clubes"
          className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20"
        >
          Gestionar clubes →
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Clubes activos", value: String(clubsActive ?? 0), tone: "from-cyan-500/20 to-blue-600/10" },
          { label: "Jugadores registrados", value: String(playersTotal ?? 0), tone: "from-violet-500/20 to-fuchsia-600/10" },
          { label: "Reservas (histórico)", value: String(reservasAll ?? 0), tone: "from-emerald-500/20 to-teal-600/10" },
          { label: "Reservas este mes", value: String(reservasMonth ?? 0), tone: "from-amber-500/20 to-orange-600/10" },
          { label: "Ingresos turnos pagados (suma total)", value: money(ingresosPagados), tone: "from-green-500/20 to-lime-600/10" },
          { label: "Deuda PadeLibre pendiente", value: money(deudaTotal), tone: "from-rose-500/20 to-red-600/10" },
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl border border-white/10 bg-gradient-to-br ${c.tone} p-5 shadow-lg shadow-black/20`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Reservas por mes (últimos 6)</h2>
        <div className="mt-6 flex h-48 items-end gap-2">
          {chartBars.map((b) => (
            <div key={b.ym} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full max-w-[52px] rounded-t-lg bg-gradient-to-t from-cyan-600 to-cyan-400 transition-all"
                style={{ height: `${(b.count / maxBar) * 100}%`, minHeight: b.count ? "8px" : "2px" }}
                title={`${b.count}`}
              />
              <span className="text-[10px] font-medium capitalize text-slate-500">{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="text-lg font-bold text-white">Clubes más activos (este mes)</h2>
          <ul className="mt-4 space-y-2">
            {topClubs.length === 0 ? (
              <li className="text-sm text-slate-500">Sin datos aún.</li>
            ) : (
              topClubs.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/50 px-3 py-2">
                  <span className="text-sm text-slate-300">
                    <span className="mr-2 font-mono text-cyan-400">{i + 1}.</span>
                    {c.name}
                  </span>
                  <span className="text-sm font-semibold text-white">{c.count} reservas</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="text-lg font-bold text-white">Alertas</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-rose-100">
              <span className="font-semibold">Deuda &gt; $50.000:</span>{" "}
              {debtAlerts.length ? (
                <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-1">
                  {debtAlerts.flatMap(([id, v], i) => [
                    i > 0 ? (
                      <span key={`sep-${id}`} className="text-rose-300/80">
                        ·
                      </span>
                    ) : null,
                    <Link key={id} href={`/superadmin/clubes/${id}`} className="underline">
                      {clubName.get(id)} ({money(v)})
                    </Link>,
                  ])}
                </span>
              ) : (
                "ninguna"
              )}
            </li>
            <li className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-amber-100">
              <span className="font-semibold">Sin reservas hace +7 días:</span>{" "}
              {idleClubs.length ? `${idleClubs.length} clubes` : "ninguno detectado"}
            </li>
            <li className="rounded-xl border border-violet-500/30 bg-violet-950/30 px-3 py-2 text-violet-100">
              <span className="font-semibold">Bloqueos esta semana:</span> {blockedWeek.count ?? 0}
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
