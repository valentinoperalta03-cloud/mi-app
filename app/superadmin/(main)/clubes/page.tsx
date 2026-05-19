import Link from "next/link";
import {
  markClubDebtsPaidAction,
  toggleClubActiveAction,
} from "@/app/superadmin/actions";
import CreateClubForm from "@/components/superadmin/create-club-form";
import ClubHealthBadge from "@/components/superadmin/club-health-badge";
import { moneyArs, type SuperadminClubOverview } from "@/lib/superadmin/club-overview";
import { requireSuperadminAction } from "@/lib/superadmin/guards";

type Filter = "all" | "active" | "inactive" | "debt" | "idle";

const filterTabs: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Activos" },
  { key: "inactive", label: "Inactivos" },
  { key: "debt", label: "Con deuda" },
  { key: "idle", label: "Sin actividad" },
];

const errorMessages: Record<string, string> = {
  datos: "Completá nombre, ubicación y email del dueño.",
  owner: "No encontramos un usuario registrado con ese email.",
  create: "No se pudo crear el club. Revisá los datos e intentá de nuevo.",
};

export default async function SuperadminClubesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; error?: string; email?: string; created?: string }>;
}) {
  const { svc } = await requireSuperadminAction();
  const sp = await searchParams;
  const raw = String(sp.f ?? "all").toLowerCase();
  const filter: Filter = filterTabs.some((t) => t.key === raw) ? (raw as Filter) : "all";

  const { data: overview } = await svc.from("superadmin_clubs_overview").select("*").order("name", { ascending: true });

  let rows = (overview ?? []) as SuperadminClubOverview[];

  if (filter === "active") rows = rows.filter((r) => r.is_active);
  if (filter === "inactive") rows = rows.filter((r) => !r.is_active);
  if (filter === "debt") rows = rows.filter((r) => Number(r.pending_debt) > 0);
  if (filter === "idle") {
    rows = rows.filter((r) => r.is_active && r.reservations_this_month === 0);
  }

  const totals = {
    clubs: rows.length,
    active: rows.filter((r) => r.is_active).length,
    debt: rows.reduce((a, r) => a + Number(r.pending_debt), 0),
    resMonth: rows.reduce((a, r) => a + Number(r.reservations_this_month), 0),
    revenueMonth: rows.reduce((a, r) => a + Number(r.revenue_paid_this_month), 0),
  };

  const errKey = String(sp.error ?? "").trim();
  const errMsg = errKey ? errorMessages[errKey] ?? "Ocurrió un error." : null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold text-white">Clubes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Alta, baja, métricas y salud operativa de cada club en la plataforma.
        </p>
      </header>

      {sp.created === "1" ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
          Club creado correctamente.
        </p>
      ) : null}

      {errMsg ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {errMsg}
          {sp.email ? ` (${sp.email})` : null}
        </p>
      ) : null}

      <CreateClubForm />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Clubes (filtro)", value: String(totals.clubs) },
          { label: "Activos", value: String(totals.active) },
          { label: "Reservas del mes", value: String(totals.resMonth) },
          { label: "Ingresos pagados (mes)", value: moneyArs(totals.revenueMonth) },
          { label: "Deuda pendiente", value: moneyArs(totals.debt) },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="mt-1 text-xl font-bold text-white">{c.value}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        {filterTabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/superadmin/clubes" : `/superadmin/clubes?f=${t.key}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              filter === t.key
                ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-500/40"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-950/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Club</th>
              <th className="px-4 py-3">Salud</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Canchas</th>
              <th className="px-4 py-3">Res. mes</th>
              <th className="px-4 py-3">Part. abiertos</th>
              <th className="px-4 py-3">Ingresos mes</th>
              <th className="px-4 py-3">Jug. 30d</th>
              <th className="px-4 py-3">Deuda</th>
              <th className="px-4 py-3">MP</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                  No hay clubes con este filtro.
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                const debt = Number(c.pending_debt);
                return (
                  <tr key={c.id} className="text-slate-200">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{c.name ?? "—"}</p>
                      <p className="text-xs text-slate-500">{c.location ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ClubHealthBadge row={c} />
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-slate-400">{c.owner_email ?? "—"}</td>
                    <td className="px-4 py-3">{c.courts_count}</td>
                    <td className="px-4 py-3">{c.reservations_this_month}</td>
                    <td className="px-4 py-3">{c.open_matches_this_month}</td>
                    <td className="px-4 py-3">{moneyArs(Number(c.revenue_paid_this_month))}</td>
                    <td className="px-4 py-3">{c.unique_players_30d}</td>
                    <td className="px-4 py-3">{moneyArs(debt)}</td>
                    <td className="px-4 py-3">
                      <span className={c.mp_connected ? "text-emerald-300" : "text-amber-300"}>
                        {c.mp_connected ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/superadmin/clubes/${c.id}`}
                          className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-white hover:bg-white/10"
                        >
                          Detalle
                        </Link>
                        <form action={toggleClubActiveAction}>
                          <input type="hidden" name="club_id" value={c.id} />
                          <input type="hidden" name="next_active" value={c.is_active ? "0" : "1"} />
                          <button
                            type="submit"
                            className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                              c.is_active
                                ? "border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
                                : "border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                            }`}
                          >
                            {c.is_active ? "Dar de baja" : "Dar de alta"}
                          </button>
                        </form>
                        {debt > 0 ? (
                          <form action={markClubDebtsPaidAction}>
                            <input type="hidden" name="club_id" value={c.id} />
                            <input type="hidden" name="return_to" value="/superadmin/clubes" />
                            <button
                              type="submit"
                              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200"
                            >
                              Deuda pagada
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
