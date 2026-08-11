import { redirect } from "next/navigation";
import Link from "next/link";
import AdminBackLink from "@/components/admin/admin-back-link";
import AdminPageHeader from "@/components/admin/admin-page-header";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import FinanceModule from "./finance-module";
import FinancePinModal from "./finance-pin-modal";

type PageProps = {
  searchParams?: Promise<{ pin_saved?: string; pin_error?: string }>;
};

/** DB: indice en matches(court_id) y, si filtras por fecha, (court_id, date) acelera esta vista. */
export default async function AdminFinanzasPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const clubId = ctx.clubIds[0];
  // finance_pin esta revocada para anon/authenticated: se lee con service client.
  const { data: clubRow } = clubId
    ? await createServiceClient()
        .from(DB_TABLES.clubs)
        .select("finance_pin")
        .eq("id", clubId)
        .eq("owner_id", ctx.userId)
        .maybeSingle()
    : { data: null };
  const hasFinancePin = Boolean(String((clubRow as { finance_pin?: string | null } | null)?.finance_pin ?? "").trim());

  const decode = (key?: string) => (key ? decodeURIComponent(key) : "");
  const pinOk = sp.pin_saved === "1";
  const pinErr = decode(sp.pin_error);

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
      <FinanceModule courtIds={ctx.courtIds} courts={ctx.courts} />

      <div className="mt-2 flex justify-center">
        <FinancePinModal hasFinancePin={hasFinancePin} pinOk={pinOk} pinErr={pinErr} />
      </div>
    </div>
  );
}
