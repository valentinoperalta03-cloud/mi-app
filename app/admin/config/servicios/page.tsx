import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import AdminPageHeader from "@/components/admin/admin-page-header";
import { adminCard } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import ServiciosForm from "./servicios-form";

export const dynamic = "force-dynamic";

export default async function AdminConfigServiciosPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length) redirect("/admin/config");

  const clubId = ctx.clubIds[0];
  const { data: clubRow } = await supabase
    .from(DB_TABLES.clubs)
    .select("services")
    .eq("id", clubId)
    .eq("owner_id", ctx.userId)
    .maybeSingle();

  const defaultServices = ((clubRow as { services?: string[] | null } | null)?.services ?? []).filter(
    Boolean
  );

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/config" label="Volver a Configuración" />
      <AdminPageHeader
        kicker="Configuración"
        title="Servicios del club"
        subtitle="Seleccioná los servicios que ofrece tu club. Aparecen en tu página pública."
      />

      <section className={`${adminCard} p-6`}>
        <ServiciosForm clubId={clubId} defaultServices={defaultServices} />
      </section>
    </div>
  );
}
