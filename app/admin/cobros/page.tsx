import Link from "next/link";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { AR_TIME_ZONE, getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { confirmOfflineCobro, markOfflineNoShow } from "./actions";

function isYmdInArgentina(iso: string, ymd: string): boolean {
  return (
    new Intl.DateTimeFormat("en-CA", {
      timeZone: AR_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso)) === ymd
  );
}

type PageProps = {
  searchParams?: Promise<{ error?: string; ok?: string }>;
};

export default async function AdminCobrosPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.courtIds.length) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-28 pt-6 md:px-8">
        <AdminBackLink />
        <p className="text-sm text-slate-600 dark:text-slate-300">No hay canchas asignadas a tu club.</p>
      </div>
    );
  }

  const todayAr = getTodayYmdInArgentina();
  const clubId = ctx.clubIds[0]!;

  const [{ data: pendingRows, error: pendErr }, { data: payRows }, { data: debtRows }] = await Promise.all([
    supabase
      .from(DB_TABLES.matches)
      .select("id, owner_id, court_id, scheduled_time, total_price, payment_status, match_type")
      .in("court_id", ctx.courtIds)
      .eq("scheduled_date", todayAr)
      .in("payment_status", ["cash_pending", "transfer_pending"])
      .order("scheduled_time", { ascending: true }),
    supabase
      .from(DB_TABLES.payments)
      .select("amount, updated_at, payment_method, match_id, matches!inner(court_id)")
      .eq("status", "approved")
      .in("payment_method", ["cash", "transfer"]),
    supabase
      .from(DB_TABLES.clubDebts)
      .select("id, amount, confirmed_at, payment_method, match_id")
      .eq("club_id", clubId)
      .order("confirmed_at", { ascending: false })
      .limit(80),
  ]);

  const pending = (pendingRows ?? []) as Array<{
    id: string;
    owner_id: string;
    court_id: string;
    scheduled_time: string | null;
    total_price: number | null;
    payment_status: string | null;
    match_type: string | null;
  }>;

  const courtName = new Map(ctx.courts.map((c) => [c.id, c.name ?? "Cancha"]));
  const ownerIds = [...new Set(pending.map((p) => p.owner_id).filter(Boolean))];
  const { data: profs } = ownerIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id, name").in("user_id", ownerIds)
    : { data: [] };
  const ownerName = new Map(
    ((profs ?? []) as Array<{ user_id: string; name: string | null }>).map((p) => [
      p.user_id,
      p.name?.trim() || "Jugador",
    ])
  );

  const paymentsAll = (payRows ?? []) as Array<{
    amount: number | null;
    updated_at: string | null;
    payment_method: string | null;
    match_id: string;
    matches: { court_id: string } | { court_id: string }[] | null;
  }>;
  const paymentsToday = paymentsAll.filter((p) => {
    const rel = p.matches;
    const court = Array.isArray(rel) ? rel[0]?.court_id : rel?.court_id;
    if (!court || !ctx.courtIds.includes(court)) return false;
    const u = p.updated_at;
    if (!u) return false;
    return isYmdInArgentina(u, todayAr);
  });
  const confirmadosHoy = paymentsToday.length;
  const totalCobradoHoy = paymentsToday.reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const debts = (debtRows ?? []) as Array<{
    id: string;
    amount: number | null;
    confirmed_at: string;
    payment_method: string | null;
    match_id: string | null;
  }>;
  const debtsTodayCount = debts.filter((d) => isYmdInArgentina(d.confirmed_at, todayAr)).length;

  const err = sp.error ? decodeURIComponent(sp.error) : "";
  const ok = sp.ok === "1";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-28 pt-6 md:max-w-3xl md:px-8">
      <AdminBackLink />
      <header className="space-y-1">
        <p className={adminKicker}>Operaciones</p>
        <h1 className={adminTitle}>Cobros del día</h1>
        <p className={adminSubtitle}>Confirmá los pagos pendientes de efectivo y transferencia</p>
      </header>

      {ok ? (
        <p className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          Actualizado correctamente.
        </p>
      ) : null}
      {err ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
          {err}
        </p>
      ) : null}
      {pendErr ? (
        <p className="text-sm text-rose-600">No se pudieron cargar los pendientes: {pendErr.message}</p>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={adminCard}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pendientes de cobro</p>
          <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">{pending.length}</p>
        </div>
        <div className={adminCard}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Confirmados hoy</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{confirmadosHoy}</p>
          <p className="mt-1 text-[10px] font-medium text-slate-400">Incluye efectivo y transferencia</p>
        </div>
        <div className={adminCard}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total cobrado hoy</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            ${totalCobradoHoy.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </p>
          {debtsTodayCount > 0 ? (
            <p className="mt-1 text-[10px] font-medium text-slate-400">{debtsTodayCount} deuda(s) PadeLibre registradas</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pendientes ({todayAr})</h2>
        {pending.length === 0 ? (
          <p className={`${adminCard} text-sm text-slate-500 dark:text-slate-400`}>No hay cobros pendientes para hoy.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((m) => {
              const pay = String(m.payment_status ?? "").toLowerCase();
              const methodLabel =
                pay === "cash_pending" ? "Efectivo" : pay === "transfer_pending" ? "Transferencia" : "MP";
              const name = ownerName.get(m.owner_id) ?? "Jugador";
              const time = String(m.scheduled_time ?? "").slice(0, 5);
              const court = courtName.get(m.court_id) ?? "Cancha";
              const amount = Number(m.total_price ?? 0);
              return (
                <li
                  key={m.id}
                  className={`${adminCard} flex flex-col gap-3 border-slate-200/90 dark:border-slate-700`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100">{name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {court} · {time} ·{" "}
                        {String(m.match_type ?? "").toLowerCase() === "reservation" ? "Reserva" : "Partido"}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      ${amount.toLocaleString("es-AR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Método:</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {methodLabel}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <form action={confirmOfflineCobro} className="flex-1">
                      <input type="hidden" name="match_id" value={m.id} />
                      <button
                        type="submit"
                        className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] dark:bg-emerald-500 dark:hover:bg-emerald-600"
                      >
                        Confirmar cobro
                      </button>
                    </form>
                    <form action={markOfflineNoShow} className="flex-1">
                      <input type="hidden" name="match_id" value={m.id} />
                      <button
                        type="submit"
                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        No se presentó
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        ¿Problemas con un cobro?{" "}
        <Link href="/admin/config" className="font-semibold text-[#0585FC] hover:underline">
          Configuración
        </Link>
      </p>
    </div>
  );
}
