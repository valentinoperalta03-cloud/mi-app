import Link from "next/link";
import { endOfMonth, format, startOfMonth } from "date-fns";
import {
  markClubDebtsPaidAction,
  toggleClubActiveAction,
} from "@/app/superadmin/actions";
import { DB_TABLES } from "@/lib/db-tables";
import { requireSuperadminAction } from "@/lib/superadmin/guards";

type Filter = "all" | "active" | "inactive" | "debt";

function money(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

const filterTabs: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Activos" },
  { key: "inactive", label: "Inactivos" },
  { key: "debt", label: "Con deuda" },
];

export default async function SuperadminClubesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { svc } = await requireSuperadminAction();
  const sp = await searchParams;
  const raw = String(sp.f ?? "all").toLowerCase();
  const filter: Filter = filterTabs.some((t) => t.key === raw) ? (raw as Filter) : "all";

  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const [{ data: overview }, { data: courtsRows }, { data: monthMatches }, { data: debtRows }] = await Promise.all([
    svc.from("superadmin_clubs_overview").select("*").order("name", { ascending: true }),
    svc.from(DB_TABLES.courts).select("id, club_id"),
    svc
      .from(DB_TABLES.matches)
      .select("court_id")
      .eq("match_type", "reservation")
      .neq("match_status", "cancelled")
      .gte("scheduled_date", monthStart)
      .lte("scheduled_date", monthEnd),
    svc.from(DB_TABLES.clubDebts).select("club_id, amount").eq("status", "pending"),
  ]);

  const courtToClub = new Map((courtsRows ?? []).map((c) => [String((c as { id: string }).id), String((c as { club_id: string }).club_id)]));
  const courtsPerClub = new Map<string, number>();
  for (const c of courtsRows ?? []) {
    const cid = String((c as { club_id: string }).club_id);
    courtsPerClub.set(cid, (courtsPerClub.get(cid) ?? 0) + 1);
  }

  const resMonthByClub = new Map<string, number>();
  for (const m of monthMatches ?? []) {
    const courtId = String((m as { court_id: string }).court_id);
    const clubId = courtToClub.get(courtId);
    if (!clubId) continue;
    resMonthByClub.set(clubId, (resMonthByClub.get(clubId) ?? 0) + 1);
  }

  const debtByClub = new Map<string, number>();
  for (const d of debtRows ?? []) {
    const row = d as { club_id: string; amount: number | null };
    debtByClub.set(row.club_id, (debtByClub.get(row.club_id) ?? 0) + Number(row.amount ?? 0));
  }

  type Ov = {
    id: string;
    name: string | null;
    location: string | null;
    owner_email: string | null;
    club_created_at: string;
    is_active: boolean;
    mp_access_token: string | null;
  };

  let rows = (overview ?? []) as Ov[];
  if (filter === "active") rows = rows.filter((r) => r.is_active);
  if (filter === "inactive") rows = rows.filter((r) => !r.is_active);
  if (filter === "debt") rows = rows.filter((r) => (debtByClub.get(r.id) ?? 0) > 0);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold text-white">Clubes</h1>
        <p className="mt-1 text-sm text-slate-400">Gestión global de clubes registrados en PadeLibre.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {filterTabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/superadmin/clubes" : `/superadmin/clubes?f=${t.key}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              filter === t.key ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-500/40" : "bg-white/5 text-slate-300 hover:bg-white/10"
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
              <th className="px-4 py-3">Ciudad</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Canchas</th>
              <th className="px-4 py-3">Reservas mes</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Deuda</th>
              <th className="px-4 py-3">Mercado Pago</th>
              <th className="px-4 py-3">Alta</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  No hay clubes con este filtro.
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                const debt = debtByClub.get(c.id) ?? 0;
                const mp = Boolean(c.mp_access_token);
                return (
                  <tr key={c.id} className="text-slate-200">
                    <td className="px-4 py-3 font-medium text-white">{c.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400">{c.location ?? "—"}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-slate-400">{c.owner_email ?? "—"}</td>
                    <td className="px-4 py-3">{courtsPerClub.get(c.id) ?? 0}</td>
                    <td className="px-4 py-3">{resMonthByClub.get(c.id) ?? 0}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          c.is_active ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200"
                        }`}
                      >
                        {c.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{money(debt)}</td>
                    <td className="px-4 py-3">
                      <span className={mp ? "text-emerald-300" : "text-amber-300"}>{mp ? "Conectado" : "No conectado"}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {c.club_created_at ? format(new Date(c.club_created_at), "dd/MM/yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/superadmin/clubes/${c.id}`}
                          className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-white hover:bg-white/10"
                        >
                          Ver detalle
                        </Link>
                        <Link
                          href={`/superadmin/clubes/${c.id}#deuda`}
                          className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/10"
                        >
                          Ver deuda
                        </Link>
                        <form action={toggleClubActiveAction}>
                          <input type="hidden" name="club_id" value={c.id} />
                          <input type="hidden" name="next_active" value={c.is_active ? "0" : "1"} />
                          <button
                            type="submit"
                            className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
                          >
                            {c.is_active ? "Desactivar" : "Activar"}
                          </button>
                        </form>
                        {debt > 0 ? (
                          <form action={markClubDebtsPaidAction}>
                            <input type="hidden" name="club_id" value={c.id} />
                            <input type="hidden" name="return_to" value="/superadmin/clubes" />
                            <button
                              type="submit"
                              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
                            >
                              Marcar deuda pagada
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
