import { endOfWeek, format, startOfWeek, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { DB_TABLES } from "@/lib/db-tables";
import { requireSuperadminAction } from "@/lib/superadmin/guards";

function barClass() {
  return "rounded-t-md bg-gradient-to-t from-violet-600 to-fuchsia-400 transition-all";
}

export default async function SuperadminEstadisticasPage() {
  const { svc } = await requireSuperadminAction();

  const [{ data: matches }, { data: clubs }, { data: profiles }, { data: courts }] = await Promise.all([
    svc
      .from(DB_TABLES.matches)
      .select("id,court_id,scheduled_time,payment_method,payment_status,match_type,match_status")
      .eq("match_type", "reservation")
      .neq("match_status", "cancelled")
      .limit(12_000),
    svc.from(DB_TABLES.clubs).select("id,location"),
    svc.from(DB_TABLES.profiles).select("created_at").order("created_at", { ascending: false }).limit(5000),
    svc.from(DB_TABLES.courts).select("id,name,club_id"),
  ]);

  const courtToClub = new Map((courts ?? []).map((c) => [String((c as { id: string }).id), String((c as { club_id: string }).club_id)]));
  const clubLocation = new Map((clubs ?? []).map((c) => [String((c as { id: string }).id), String((c as { location: string | null }).location ?? "Sin ciudad")]));
  const courtName = new Map((courts ?? []).map((c) => [String((c as { id: string }).id), String((c as { name: string | null }).name ?? "Cancha")]));

  const byCity = new Map<string, number>();
  const byHour = new Map<number, number>();
  const byCourt = new Map<string, number>();
  const payMix = { mercadopago: 0, cash: 0, transfer: 0, other: 0 };

  for (const m of matches ?? []) {
    const row = m as { court_id: string; scheduled_time: string | null; payment_method: string | null; payment_status: string | null };
    const clubId = courtToClub.get(row.court_id);
    if (clubId) {
      const loc = clubLocation.get(clubId) ?? "Sin ciudad";
      byCity.set(loc, (byCity.get(loc) ?? 0) + 1);
    }
    byCourt.set(row.court_id, (byCourt.get(row.court_id) ?? 0) + 1);

    const t = String(row.scheduled_time ?? "00:00").slice(0, 2);
    const h = Number.parseInt(t, 10);
    if (Number.isFinite(h) && h >= 0 && h <= 23) {
      byHour.set(h, (byHour.get(h) ?? 0) + 1);
    }

    const paid = String(row.payment_status ?? "").toLowerCase() === "paid";
    if (paid) {
      const pm = String(row.payment_method ?? "").toLowerCase();
      if (pm.includes("mercadopago")) payMix.mercadopago += 1;
      else if (pm === "cash") payMix.cash += 1;
      else if (pm === "transfer") payMix.transfer += 1;
      else payMix.other += 1;
    }
  }

  const cityBars = [...byCity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const maxCity = Math.max(1, ...cityBars.map(([, n]) => n));

  const hourBars = Array.from({ length: 24 }, (_, h) => ({ h, c: byHour.get(h) ?? 0 }));
  const maxHour = Math.max(1, ...hourBars.map((x) => x.c));

  const topCourts = [...byCourt.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const maxCourt = Math.max(1, ...topCourts.map(([, n]) => n));

  const now = new Date();
  const weekStarts = Array.from({ length: 8 }, (_, i) => startOfWeek(subWeeks(now, 7 - i), { weekStartsOn: 1 }));

  const newPlayersWeek = weekStarts.map((start) => {
    const end = endOfWeek(start, { weekStartsOn: 1 });
    let c = 0;
    for (const pr of profiles ?? []) {
      const created = (pr as { created_at: string | null }).created_at;
      if (!created) continue;
      const d = new Date(created);
      if (d >= start && d <= end) c += 1;
    }
    return { label: format(start, "d MMM", { locale: es }), count: c };
  });
  const maxNew = Math.max(1, ...newPlayersWeek.map((x) => x.count));

  const payTotal = payMix.mercadopago + payMix.cash + payMix.transfer + payMix.other;
  const payBars = [
    { label: "Mercado Pago", count: payMix.mercadopago, color: "from-sky-600 to-cyan-400" },
    { label: "Efectivo", count: payMix.cash, color: "from-emerald-600 to-lime-400" },
    { label: "Transferencia", count: payMix.transfer, color: "from-amber-600 to-orange-400" },
    { label: "Otros", count: payMix.other, color: "from-slate-600 to-slate-400" },
  ];
  const maxPay = Math.max(1, ...payBars.map((b) => b.count));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12">
      <header>
        <h1 className="text-3xl font-bold text-white">Estadísticas</h1>
        <p className="mt-1 text-sm text-slate-400">Vista agregada de la actividad en PadeLibre.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Reservas por ciudad</h2>
        <div className="mt-6 flex h-52 items-end gap-2 overflow-x-auto pb-2">
          {cityBars.length === 0 ? (
            <p className="text-sm text-slate-500">Sin datos.</p>
          ) : (
            cityBars.map(([city, count]) => (
              <div key={city} className="flex min-w-[44px] flex-1 flex-col items-center gap-2">
                <div
                  className={barClass()}
                  style={{ height: `${(count / maxCity) * 100}%`, minHeight: count ? "6px" : "2px", width: "100%", maxWidth: "48px" }}
                  title={`${city}: ${count}`}
                />
                <span className="max-w-[72px] truncate text-center text-[9px] font-medium text-slate-500" title={city}>
                  {city}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Jugadores nuevos por semana (últimas 8)</h2>
        <div className="mt-6 flex h-48 items-end gap-1">
          {newPlayersWeek.map((w, i) => (
            <div key={`${w.label}-${i}`} className="flex flex-1 flex-col items-center gap-2">
              <div
                className={barClass()}
                style={{ height: `${(w.count / maxNew) * 100}%`, minHeight: w.count ? "6px" : "2px", width: "100%", maxWidth: "40px" }}
                title={`${w.count}`}
              />
              <span className="text-[9px] font-medium capitalize text-slate-500">{w.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="text-lg font-bold text-white">Métodos de pago (reservas pagadas)</h2>
          <p className="mt-1 text-xs text-slate-500">Total muestras: {payTotal}</p>
          <div className="mt-6 flex h-40 items-end gap-3">
            {payBars.map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className={`w-full max-w-[56px] rounded-t-lg bg-gradient-to-t ${b.color}`}
                  style={{ height: `${(b.count / maxPay) * 100}%`, minHeight: b.count ? "8px" : "2px" }}
                  title={`${b.label}: ${b.count}`}
                />
                <span className="text-center text-[10px] font-medium text-slate-500">{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="text-lg font-bold text-white">Canchas más reservadas</h2>
          <ul className="mt-4 space-y-2">
            {topCourts.length === 0 ? (
              <li className="text-sm text-slate-500">Sin datos.</li>
            ) : (
              topCourts.map(([courtId, count], i) => (
                <li key={courtId} className="flex items-center gap-3 text-sm">
                  <span className="w-6 font-mono text-cyan-400">{i + 1}.</span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-violet-500" style={{ width: `${(count / maxCourt) * 100}%` }} />
                    </div>
                  </div>
                  <span className="w-40 truncate text-right text-slate-300" title={courtName.get(courtId)}>
                    {courtName.get(courtId)}
                  </span>
                  <span className="w-10 text-right font-semibold text-white">{count}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Horarios más populares (hora de inicio)</h2>
        <div className="mt-6 flex h-44 items-end gap-1 overflow-x-auto">
          {hourBars.map(({ h, c }) => (
            <div key={h} className="flex w-6 shrink-0 flex-col items-center gap-1">
              <div
                className={barClass()}
                style={{ height: `${(c / maxHour) * 100}%`, minHeight: c ? "4px" : "1px", width: "100%" }}
                title={`${h}:00 — ${c}`}
              />
              <span className="text-[9px] text-slate-600">{h}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
