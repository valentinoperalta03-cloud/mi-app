import Link from "next/link";
import { toggleClubActiveAction } from "@/app/superadmin/actions";
import ClubHealthBadge from "@/components/superadmin/club-health-badge";
import DeleteClubForm from "@/components/superadmin/delete-club-form";
import SubscriptionBadge from "@/components/superadmin/subscription-badge";
import { moneyArs, type SuperadminClubOverview } from "@/lib/superadmin/club-overview";
import { requireSuperadminAction } from "@/lib/superadmin/guards";

type Filter = "all" | "pending" | "trial" | "active" | "problems";

const filterTabs: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Sin tarjeta" },
  { key: "trial", label: "En trial" },
  { key: "active", label: "Suscripción activa" },
  { key: "problems", label: "Con problemas" },
];

export default async function SuperadminClubesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; deleted?: string; delete_error?: string; active_error?: string }>;
}) {
  const { svc } = await requireSuperadminAction();
  const sp = await searchParams;
  const raw = String(sp.f ?? "all").toLowerCase();
  const filter: Filter = filterTabs.some((t) => t.key === raw) ? (raw as Filter) : "all";

  const { data: overview } = await svc.from("superadmin_clubs_overview").select("*").order("name", { ascending: true });

  let rows = (overview ?? []) as SuperadminClubOverview[];

  if (filter === "pending") rows = rows.filter((r) => r.subscription_status === "pending");
  if (filter === "trial") rows = rows.filter((r) => r.subscription_status === "trial");
  if (filter === "active") rows = rows.filter((r) => r.subscription_status === "active");
  if (filter === "problems") {
    rows = rows.filter(
      (r) =>
        r.subscription_status === "past_due" ||
        r.subscription_status === "paused" ||
        r.subscription_status === "trial_expired"
    );
  }

  const totals = {
    clubs: rows.length,
    subsActive: rows.filter((r) => r.subscription_status === "active").length,
    resMonth: rows.reduce((a, r) => a + Number(r.reservations_this_month), 0),
    revenueMonth: rows.reduce((a, r) => a + Number(r.revenue_paid_this_month), 0),
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold text-white">Clubes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Alta, baja, suscripción y salud operativa de cada club en la plataforma.
        </p>
      </header>

      {sp.deleted === "1" ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
          Club eliminado correctamente.
        </p>
      ) : null}

      {sp.delete_error === "1" ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          No se pudo eliminar el club.
        </p>
      ) : null}

      {sp.active_error === "1" ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          No se pudo cambiar el estado operativo del club. Reintentá o revisá los logs.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Clubes (filtro)", value: String(totals.clubs) },
          { label: "Suscripciones activas", value: String(totals.subsActive) },
          { label: "Reservas del mes", value: String(totals.resMonth) },
          { label: "Ingresos pagados (mes)", value: moneyArs(totals.revenueMonth) },
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
              <th className="hidden px-4 py-3 md:table-cell">Owner</th>
              <th className="hidden px-4 py-3 lg:table-cell">Canchas</th>
              <th className="hidden px-4 py-3 md:table-cell">Res. mes</th>
              <th className="hidden px-4 py-3 lg:table-cell">Part. abiertos</th>
              <th className="hidden px-4 py-3 md:table-cell">Ingresos mes</th>
              <th className="hidden px-4 py-3 lg:table-cell">Jug. 30d</th>
              <th className="px-4 py-3">Suscripción</th>
              <th className="hidden px-4 py-3 lg:table-cell">Próximo cobro</th>
              <th className="hidden px-4 py-3 md:table-cell">MP</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                  No hay clubes con este filtro.
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                return (
                  <tr key={c.id} className="text-slate-200">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{c.name ?? "—"}</p>
                      <p className="text-xs text-slate-500">{c.city ?? c.location ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ClubHealthBadge row={c} />
                    </td>
                    <td className="hidden max-w-[160px] truncate px-4 py-3 text-slate-400 md:table-cell">{c.owner_email ?? "—"}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">{c.courts_count}</td>
                    <td className="hidden px-4 py-3 md:table-cell">{c.reservations_this_month}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">{c.open_matches_this_month}</td>
                    <td className="hidden px-4 py-3 md:table-cell">{moneyArs(Number(c.revenue_paid_this_month))}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">{c.unique_players_30d}</td>
                    <td className="px-4 py-3">
                      <SubscriptionBadge row={c} />
                    </td>
                    <td className="hidden px-4 py-3 text-slate-400 lg:table-cell">
                      {c.next_billing_date ? new Date(c.next_billing_date).toLocaleDateString("es-AR") : "—"}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
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
                        <DeleteClubForm
                          clubId={c.id}
                          clubName={c.name ?? "Club"}
                          returnTo="/superadmin/clubes"
                          variant="inline"
                        />
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
