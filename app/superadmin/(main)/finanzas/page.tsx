import Link from "next/link";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { markClubDebtsPaidAction, sendDebtReminderAction } from "@/app/superadmin/actions";
import { DB_TABLES } from "@/lib/db-tables";
import { requireSuperadminAction } from "@/lib/superadmin/guards";

function money(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

function feeRate() {
  const raw = process.env.MP_MARKETPLACE_FEE ?? "0.05";
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0.05;
}

type PageProps = {
  searchParams: Promise<{ club?: string; mes?: string; metodo?: string }>;
};

export default async function SuperadminFinanzasPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { svc } = await requireSuperadminAction();
  const rate = feeRate();
  const ratePct = Math.round(rate * 100);

  const now = new Date();
  const monthParam = String(sp.mes ?? "").trim();
  const monthOk = /^\d{4}-\d{2}$/.test(monthParam);
  const refMonth = monthOk ? new Date(`${monthParam}-01T12:00:00`) : now;
  const monthStart = format(startOfMonth(refMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(refMonth), "yyyy-MM-dd");

  const clubFilter = String(sp.club ?? "").trim();
  const metodo = String(sp.metodo ?? "all").toLowerCase();

  const [{ data: overview }, { data: pendingDebts }, { data: paymentsRaw }] = await Promise.all([
    svc.from("superadmin_clubs_overview").select("id,name").order("name"),
    svc.from(DB_TABLES.clubDebts).select("club_id,amount,payment_method").eq("status", "pending"),
    svc
      .from(DB_TABLES.payments)
      .select(
        "id,created_at,amount,status,payment_method,marketplace_fee,user_id,match_id,matches!inner(scheduled_date,match_type,court_id)"
      )
      .eq("matches.match_type", "reservation")
      .order("created_at", { ascending: false })
      .limit(800),
  ]);

  const clubName = new Map((overview ?? []).map((r) => [(r as { id: string }).id, String((r as { name: string | null }).name ?? "Club")]));

  const { data: courtsRows } = await svc.from(DB_TABLES.courts).select("id, club_id");
  const courtToClub = new Map((courtsRows ?? []).map((c) => [String((c as { id: string }).id), String((c as { club_id: string }).club_id)]));

  type PayRow = {
    id: string;
    created_at: string;
    amount: number | null;
    status: string | null;
    payment_method: string | null;
    marketplace_fee: number | null;
    user_id: string;
    match_id: string | null;
    matches:
      | { scheduled_date: string | null; match_type: string | null; court_id: string }
      | { scheduled_date: string | null; match_type: string | null; court_id: string }[]
      | null;
  };

  const payments = (paymentsRaw ?? []) as PayRow[];

  const isApproved = (s: string | null) => {
    const x = String(s ?? "").toLowerCase();
    return x === "approved" || x === "paid";
  };

  const isMp = (m: string | null) => String(m ?? "").toLowerCase().includes("mercadopago");

  let mpMonthTotal = 0;
  let mpHistoricTotal = 0;
  for (const p of payments) {
    const m = Array.isArray(p.matches) ? p.matches[0] : p.matches;
    if (!m?.scheduled_date) continue;
    if (!isApproved(p.status) || !isMp(p.payment_method)) continue;
    const fee = Number(p.marketplace_fee ?? 0);
    mpHistoricTotal += fee;
    if (m.scheduled_date >= monthStart && m.scheduled_date <= monthEnd) {
      mpMonthTotal += fee;
    }
  }

  const debtTotal = (pendingDebts ?? []).reduce((a, r) => a + Number((r as { amount: number | null }).amount ?? 0), 0);

  type DebtAgg = { amount: number; cashTransferCount: number };
  const byClubDebt = new Map<string, DebtAgg>();
  for (const r of pendingDebts ?? []) {
    const row = r as { club_id: string; amount: number | null; payment_method: string | null };
    const cur = byClubDebt.get(row.club_id) ?? { amount: 0, cashTransferCount: 0 };
    cur.amount += Number(row.amount ?? 0);
    const pm = String(row.payment_method ?? "").toLowerCase();
    if (pm === "cash" || pm === "transfer") cur.cashTransferCount += 1;
    byClubDebt.set(row.club_id, cur);
  }

  const debtList = [...byClubDebt.entries()]
    .filter(([, v]) => v.amount > 0)
    .sort((a, b) => b[1].amount - a[1].amount);

  const historial = payments
    .map((p) => {
      const m = Array.isArray(p.matches) ? p.matches[0] : p.matches;
      if (!m?.court_id) return null;
      const clubId = courtToClub.get(String(m.court_id));
      if (!clubId) return null;
      return {
        ...p,
        scheduled_date: m.scheduled_date,
        club_id: clubId,
        club_label: clubName.get(clubId) ?? "Club",
      };
    })
    .filter(Boolean) as Array<
      PayRow & { scheduled_date: string | null; club_id: string; club_label: string }
    >;

  const historialFiltered = historial.filter((row) => {
    if (clubFilter && row.club_id !== clubFilter) return false;
    if (monthOk) {
      const sd = row.scheduled_date ?? "";
      if (sd < monthStart || sd > monthEnd) return false;
    }
    if (metodo !== "all") {
      const pm = String(row.payment_method ?? "").toLowerCase();
      if (metodo === "mercadopago" && !pm.includes("mercadopago")) return false;
      if (metodo === "cash" && pm !== "cash") return false;
      if (metodo === "transfer" && pm !== "transfer") return false;
    }
    return true;
  });

  const monthOptions = Array.from({ length: 8 }, (_, i) => {
    const d = subMonths(now, i);
    return { value: format(startOfMonth(d), "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <header>
        <h1 className="text-3xl font-bold text-white">Finanzas globales</h1>
        <p className="mt-1 text-sm text-slate-400">
          Comisión PadeLibre ({ratePct}% en Mercado Pago) y deudas por reservas en efectivo/transferencia.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: `Ingresos PadeLibre (${ratePct}% MP) este mes`, value: money(mpMonthTotal) },
          { label: "Deuda pendiente clubes (efectivo/transf.)", value: money(debtTotal) },
          { label: "Comisión MP histórica (aprobadas)", value: money(mpHistoricTotal) },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="mt-2 text-xl font-bold text-white">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Deudas por club</h2>
        <ul className="mt-4 space-y-3">
          {debtList.length === 0 ? (
            <li className="text-sm text-slate-500">No hay deudas pendientes.</li>
          ) : (
            debtList.map(([clubId, agg]) => (
              <li
                key={clubId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-950/50 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-white">{clubName.get(clubId) ?? "Club"}</p>
                  <p className="text-xs text-slate-500">
                    {money(agg.amount)} · {agg.cashTransferCount} registro(s) efectivo/transf.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={markClubDebtsPaidAction}>
                    <input type="hidden" name="club_id" value={clubId} />
                    <input type="hidden" name="return_to" value="/superadmin/finanzas" />
                    <button
                      type="submit"
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20"
                    >
                      Marcar como pagado
                    </button>
                  </form>
                  <form action={sendDebtReminderAction}>
                    <input type="hidden" name="club_id" value={clubId} />
                    <button
                      type="submit"
                      className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
                    >
                      Enviar recordatorio
                    </button>
                  </form>
                  <Link
                    href={`/superadmin/clubes/${clubId}#deuda`}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
                  >
                    Ver club
                  </Link>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Historial de pagos</h2>
        <form className="mt-4 flex flex-wrap gap-3 text-sm" method="get">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Club
            <select
              name="club"
              defaultValue={clubFilter}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-medium text-white"
            >
              <option value="">Todos</option>
              {(overview ?? []).map((o) => {
                const r = o as { id: string; name: string | null };
                return (
                  <option key={r.id} value={r.id}>
                    {r.name ?? r.id}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mes (fecha del turno)
            <select
              name="mes"
              defaultValue={monthOk ? monthParam : ""}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-medium text-white"
            >
              <option value="">Todos</option>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Método
            <select
              name="metodo"
              defaultValue={metodo}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-medium text-white"
            >
              <option value="all">Todos</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
            </select>
          </label>
          <button
            type="submit"
            className="self-end rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            Aplicar
          </button>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Fecha pago</th>
                <th className="py-2 pr-4">Club</th>
                <th className="py-2 pr-4">Turno</th>
                <th className="py-2 pr-4">Método</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Monto</th>
                <th className="py-2">Comisión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {historialFiltered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Sin resultados con estos filtros.
                  </td>
                </tr>
              ) : (
                historialFiltered.slice(0, 200).map((row) => (
                  <tr key={row.id} className="text-slate-300">
                    <td className="py-2 pr-4 whitespace-nowrap">{format(new Date(row.created_at), "dd/MM/yy HH:mm")}</td>
                    <td className="py-2 pr-4">{row.club_label}</td>
                    <td className="py-2 pr-4 text-slate-500">{row.scheduled_date ?? "—"}</td>
                    <td className="py-2 pr-4">{row.payment_method ?? "—"}</td>
                    <td className="py-2 pr-4">{row.status ?? "—"}</td>
                    <td className="py-2 pr-4">{money(Number(row.amount ?? 0))}</td>
                    <td className="py-2">{money(Number(row.marketplace_fee ?? 0))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
