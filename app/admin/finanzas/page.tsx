import { redirect } from "next/navigation";
import Link from "next/link";
import AdminBackLink from "@/components/admin/admin-back-link";
import AdminPageHeader from "@/components/admin/admin-page-header";
import AnalysisPinGate from "@/components/admin/analysis-pin-gate";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";
import FinanceModule from "./finance-module";

/** DB: indice en matches(court_id) y, si filtras por fecha, (court_id, date) acelera esta vista. */
export default async function AdminFinanzasPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const clubId = ctx.clubIds[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <AdminPageHeader
        kicker="Análisis"
        title="Finanzas"
        subtitle="Ingresos y egresos del club"
      />
      <Link
        href="/admin/finanzas/reembolsos"
        className="inline-flex w-fit rounded-2xl border border-emerald-200 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
      >
        Reembolsos
      </Link>

      <AnalysisPinGate clubId={clubId}>
        <FinanceModule courtIds={ctx.courtIds} courts={ctx.courts} />
      </AnalysisPinGate>
    </div>
  );
}
