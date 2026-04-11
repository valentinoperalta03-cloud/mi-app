import { redirect } from "next/navigation";
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
      <FinanceModule courtIds={ctx.courtIds} courts={ctx.courts} />
    </div>
  );
}
