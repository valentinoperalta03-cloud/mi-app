import { format, parseISO, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { PlayerAvatar } from "@/components/admin/admin-status-pills";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type PageProps = {
  searchParams: Promise<{ court?: string; status?: string }>;
};

const STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "approved", label: "Pagado" },
  { value: "pending", label: "Pendiente" },
  { value: "cancelled", label: "Cancelado" },
  { value: "refund_requested", label: "Reembolso solicitado" },
] as const;

function statusUi(status: string) {
  const s = status.toLowerCase();
  if (s === "approved" || s === "paid") {
    return {
      label: "✅ Pagado",
      className: "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    };
  }
  if (s === "pending") {
    return {
      label: "⚠️ Pendiente",
      className: "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    };
  }
  if (s === "cancelled") {
    return {
      label: "❌ Cancelado",
      className: "bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    };
  }
  if (s === "refund_requested") {
    return {
      label: "🔄 Reembolso solicitado",
      className: "bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    };
  }
  return {
    label: status || "—",
    className: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
  };
}

export default async function AdminPagosPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const selectedCourt = sp.court && ctx.courtIds.includes(sp.court) ? sp.court : "all";
  const selectedStatus = STATUS_OPTIONS.some((opt) => opt.value === sp.status) ? String(sp.status) : "all";
  const since5DaysYmd = format(subDays(new Date(), 5), "yyyy-MM-dd");

  const { data: matchIds } =
    ctx.courtIds.length > 0
      ? await supabase
          .from(DB_TABLES.matches)
          .select("id")
          .in("court_id", ctx.courtIds)
          .gte("scheduled_date", since5DaysYmd)
      : { data: [] };

  const ids = (matchIds ?? []).map((m: { id: string }) => m.id);

  const { data: paymentsRaw } =
    ids.length > 0
      ? await supabase
          .from(DB_TABLES.payments)
          .select(
            "id,user_id,amount,status,created_at,match_id,matches!inner(id,court_id,scheduled_date,scheduled_time,match_type,es_turno_fijo,courts(name)),profiles:user_id(user_id,name,avatar_url)"
          )
          .in("match_id", ids)
          .order("created_at", { ascending: false })
      : { data: [] };

  const payments = (paymentsRaw ?? []) as Array<{
    id: string;
    user_id: string;
    amount: number | null;
    status: string | null;
    created_at: string;
    match_id: string;
    matches:
      | {
          id: string;
          court_id: string;
          scheduled_date: string | null;
          scheduled_time: string | null;
          match_type: string | null;
          es_turno_fijo: boolean | null;
          courts: { name: string | null } | { name: string | null }[] | null;
        }
      | {
          id: string;
          court_id: string;
          scheduled_date: string | null;
          scheduled_time: string | null;
          match_type: string | null;
          es_turno_fijo: boolean | null;
          courts: { name: string | null } | { name: string | null }[] | null;
        }[]
      | null;
    profiles:
      | { user_id: string; name: string | null; avatar_url: string | null }
      | { user_id: string; name: string | null; avatar_url: string | null }[]
      | null;
  }>;

  const rows = payments
    .map((payment) => {
      const match = Array.isArray(payment.matches) ? payment.matches[0] ?? null : payment.matches;
      const profile = Array.isArray(payment.profiles) ? payment.profiles[0] ?? null : payment.profiles;
      if (!match || !ctx.courtIds.includes(match.court_id)) return null;
      const courtRel = Array.isArray(match.courts) ? match.courts[0] ?? null : match.courts;
      const normStatus = String(payment.status ?? "").toLowerCase();
      return {
        id: payment.id,
        userId: payment.user_id,
        name: profile?.name?.trim() || "Jugador",
        avatarUrl: profile?.avatar_url ?? null,
        amount: Number(payment.amount ?? 0),
        status: normStatus,
        courtId: match.court_id,
        courtName: courtRel?.name ?? "Cancha",
        scheduledDate: String(match.scheduled_date ?? ""),
        scheduledTime: String(match.scheduled_time ?? "").slice(0, 5),
        typeLabel: match.es_turno_fijo
          ? "Turno fijo"
          : String(match.match_type ?? "").toLowerCase() === "reservation"
            ? "Reserva"
            : "Partido",
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .filter((r) => (selectedCourt === "all" ? true : r.courtId === selectedCourt))
    .filter((r) => (selectedStatus === "all" ? true : r.status === selectedStatus));

  const totalPagos = rows.length;
  const totalPagados = rows.filter((r) => r.status === "approved" || r.status === "paid").length;
  const totalPendientes = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-emerald-600`}>Operación</p>
        <h1 className={adminTitle}>Control de pagos</h1>
        <p className={adminSubtitle}>Verificá quién pagó en los últimos 5 días</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className={adminCard}>
          <p className={adminKicker}>Total pagos</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{totalPagos}</p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Pagados</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{totalPagados}</p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Pendientes</p>
          <p className="mt-2 text-2xl font-bold text-amber-500">{totalPendientes}</p>
        </div>
      </section>

      <section className={adminCard}>
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Cancha
            <select
              name="court"
              defaultValue={selectedCourt}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">Todas las canchas</option>
              {ctx.courts.map((court) => (
                <option key={court.id} value={court.id}>
                  {court.name ?? "Cancha"}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Estado
            <select
              name="status"
              defaultValue={selectedStatus}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Filtrar
          </button>
        </form>
      </section>

      {rows.length === 0 ? (
        <section className={adminCard}>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            No hay pagos para los filtros seleccionados
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          {rows.map((row) => {
            const status = statusUi(row.status);
            const when =
              row.scheduledDate && row.scheduledTime
                ? format(parseISO(`${row.scheduledDate}T${row.scheduledTime || "00:00"}:00`), "d MMM yyyy · HH:mm", {
                    locale: es,
                  })
                : "Sin fecha";
            return (
              <article key={row.id} className={`${adminCard} border border-slate-200/80 dark:border-slate-700`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {row.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
                      <img src={row.avatarUrl} alt={row.name} className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <PlayerAvatar name={row.name} />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{row.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {row.courtName} · {when}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    ${row.amount.toFixed(2)}
                  </span>
                  <span className="rounded-full bg-[#0585FC]/10 px-2 py-1 font-semibold text-[#0461C4] dark:text-sky-300">
                    {row.typeLabel}
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
