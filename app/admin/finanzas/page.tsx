import { redirect } from "next/navigation";
import Link from "next/link";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";
import FinanceModule from "./finance-module";

/** DB: indice en matches(court_id) y, si filtras por fecha, (court_id, date) acelera esta vista. */
export default async function AdminFinanzasPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-emerald-600`}>Finanzas</p>
        <h1 className={adminTitle}>Reportes e ingresos</h1>
        <p className={adminSubtitle}>
          Agregación por <code className="text-xs text-slate-400">matches.total_price</code> con{" "}
          <code className="text-xs text-slate-400">payment_status = paid</code>.
        </p>
      </header>
      <Link
        href="/admin/finanzas/reembolsos"
        className="inline-flex w-fit rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
      >
        Reembolsos
      </Link>
      <FinanceModule courtIds={ctx.courtIds} courts={ctx.courts} />
    </div>
  );
}
