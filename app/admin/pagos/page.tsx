import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type PageProps = { searchParams: Promise<{ month?: string }> };

export default async function AdminPagosPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const now = new Date();
  const currentMonth = format(now, "yyyy-MM");
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? String(sp.month) : currentMonth;
  const monthStart = `${month}-01T00:00:00`;
  const [yy, mm] = month.split("-").map(Number);
  const nextMonth = mm === 12 ? `${yy + 1}-01` : `${yy}-${String(mm + 1).padStart(2, "0")}`;
  const nextMonthStart = `${nextMonth}-01T00:00:00`;

  const { data: paymentsRaw } =
    ctx.courtIds.length > 0
      ? await supabase
          .from(DB_TABLES.payments)
          .select("id,user_id,amount,status,created_at,match_id,matches!inner(court_id,scheduled_date,courts(name))")
          .gte("created_at", monthStart)
          .lt("created_at", nextMonthStart)
      : { data: [] };

  const payments = (paymentsRaw ?? []) as unknown as Array<{
    id: string;
    user_id: string;
    amount: number | null;
    status: string | null;
    created_at: string;
    match_id: string;
    matches: {
      court_id: string;
      scheduled_date: string | null;
      courts: { name: string | null }[] | null;
    }[] | null;
  }>;

  const rows = payments.filter((payment) => {
    const courtId = payment.matches?.[0]?.court_id;
    return Boolean(courtId && ctx.courtIds.includes(courtId));
  });
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles } = userIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", userIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p: { user_id: string; name: string | null }) => [p.user_id, p.name ?? "Jugador"]));
  const monthTotal = rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-emerald-600`}>Finanzas</p>
        <h1 className={adminTitle}>Historial de pagos</h1>
        <p className={adminSubtitle}>Pagos por reservas en canchas de tu club.</p>
      </header>
      <section className={adminCard}>
        <form className="flex items-center gap-2">
          <input type="month" name="month" defaultValue={month} className="rounded-xl border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" />
          <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Filtrar</button>
        </form>
        <p className="mt-4 text-lg font-bold text-emerald-600">Total del mes: ${monthTotal.toFixed(2)}</p>
      </section>
      <section className={`${adminCard} overflow-x-auto`}>
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2">Jugador</th><th className="py-2">Cancha</th><th className="py-2">Fecha</th><th className="py-2">Monto</th><th className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((payment) => (
              <tr key={payment.id} className="border-t border-slate-200/70">
                <td className="py-2">{nameById.get(payment.user_id) ?? "Jugador"}</td>
                <td className="py-2">{payment.matches?.[0]?.courts?.[0]?.name ?? "Cancha"}</td>
                <td className="py-2">
                  {payment.matches?.[0]?.scheduled_date
                    ? format(parseISO(`${payment.matches[0].scheduled_date}T12:00:00`), "d MMM yyyy", {
                        locale: es,
                      })
                    : "—"}
                </td>
                <td className="py-2">${Number(payment.amount ?? 0).toFixed(2)}</td>
                <td className="py-2">{String(payment.status ?? "pending")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
