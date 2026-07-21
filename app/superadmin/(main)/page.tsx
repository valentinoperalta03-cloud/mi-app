import Link from "next/link";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { DB_TABLES } from "@/lib/db-tables";
import { moneyArs, SUBSCRIPTION_PRICE_ARS, type SuperadminClubOverview } from "@/lib/superadmin/club-overview";
import { requireSuperadminAction } from "@/lib/superadmin/guards";

export default async function SuperadminDashboardPage() {
  const { svc } = await requireSuperadminAction();

  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
  const sixMonthsAgo = format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");
  const in7Days = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  const [{ data: overviewRaw }, reservasByMonth, matchesThisMonth, courtsRows] = await Promise.all([
    svc.from("superadmin_clubs_overview").select("*"),
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
  ]);

  const overview = (overviewRaw ?? []) as SuperadminClubOverview[];

  const clubsTotal = overview.length;
  const enTrial = overview.filter((r) => r.subscription_status === "pending" || r.subscription_status === "trial").length;
  const activos = overview.filter((r) => r.subscription_status === "active").length;
  const conProblemas = overview.filter((r) => r.subscription_status === "past_due" || r.subscription_status === "paused").length;
  const mrr = activos * SUBSCRIPTION_PRICE_ARS;

  const trialsPorVencer = overview
    .filter((r) => r.subscription_status === "trial" && r.trial_end_date && new Date(r.trial_end_date) <= in7Days)
    .sort((a, b) => new Date(a.trial_end_date ?? 0).getTime() - new Date(b.trial_end_date ?? 0).getTime());

  const pagosFallidos = overview
    .filter((r) => r.subscription_status === "past_due")
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  const sinTarjeta = overview
    .filter((r) => r.subscription_status === "pending")
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  const reservasTotal = overview.reduce((a, r) => a + Number(r.reservations_total), 0);
  const reservasMes = overview.reduce((a, r) => a + Number(r.reservations_this_month), 0);
  const jugadoresActivos30d = overview.reduce((a, r) => a + Number(r.unique_players_30d), 0);

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
  const clubName = new Map(overview.map((c) => [c.id, c.name ?? "Club"]));
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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard global</h1>
          <p className="mt-1 text-sm text-slate-400">Salud de suscripciones y uso de la plataforma.</p>
        </div>
        <Link
          href="/superadmin/clubes"
          className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20"
        >
          Gestionar clubes →
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Clubes totales", value: String(clubsTotal), tone: "from-cyan-500/20 to-blue-600/10" },
          { label: "En trial (sin tarjeta + trial)", value: String(enTrial), tone: "from-sky-500/20 to-blue-600/10" },
          { label: "Activos (pagando)", value: String(activos), tone: "from-emerald-500/20 to-teal-600/10" },
          { label: "Con problemas", value: String(conProblemas), tone: "from-rose-500/20 to-red-600/10" },
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

      <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-slate-900/60 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/80">MRR (ingresos recurrentes)</p>
        <p className="mt-2 text-3xl font-bold text-white">{moneyArs(mrr)}</p>
        <p className="mt-1 text-sm text-slate-400">
          {activos} club{activos === 1 ? "" : "es"} activo{activos === 1 ? "" : "s"} × {moneyArs(SUBSCRIPTION_PRICE_ARS)}/mes
        </p>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="text-lg font-bold text-white">Trials por vencer (próximos 7 días)</h2>
          <ul className="mt-4 space-y-2">
            {trialsPorVencer.length === 0 ? (
              <li className="text-sm text-slate-500">Ningún trial vence esta semana.</li>
            ) : (
              trialsPorVencer.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-xl border border-sky-500/20 bg-sky-950/30 px-3 py-2">
                  <Link href={`/superadmin/clubes/${c.id}`} className="text-sm text-sky-100 underline-offset-2 hover:underline">
                    {c.name}
                  </Link>
                  <span className="text-xs text-sky-300">
                    {c.trial_end_date ? format(new Date(c.trial_end_date), "dd/MM/yyyy") : "—"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="text-lg font-bold text-white">Pagos fallidos recientes</h2>
          <ul className="mt-4 space-y-2">
            {pagosFallidos.length === 0 ? (
              <li className="text-sm text-slate-500">Ningún club en past_due.</li>
            ) : (
              pagosFallidos.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-950/30 px-3 py-2">
                  <Link href={`/superadmin/clubes/${c.id}`} className="text-sm text-rose-100 underline-offset-2 hover:underline">
                    {c.name}
                  </Link>
                  <span className="text-xs text-rose-300">Pago fallido</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Clubes sin tarjeta cargada</h2>
        <p className="mt-1 text-xs text-slate-500">Nunca completaron el alta de suscripción (subscription_status = pending).</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {sinTarjeta.length === 0 ? (
            <li className="text-sm text-slate-500">Ninguno.</li>
          ) : (
            sinTarjeta.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/superadmin/clubes/${c.id}`}
                  className="inline-flex rounded-full border border-slate-500/30 bg-slate-800/60 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700/60"
                >
                  {c.name}
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Reservas (histórico)", value: String(reservasTotal) },
          { label: "Reservas este mes", value: String(reservasMes) },
          { label: "Jugadores activos (30d)", value: String(jugadoresActivos30d) },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-white">{c.value}</p>
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

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
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
      </section>
    </div>
  );
}
