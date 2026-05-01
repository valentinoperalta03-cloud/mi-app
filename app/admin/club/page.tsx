import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import ClubForm from "./club-form";

export default async function AdminClubPage() {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length) redirect("/admin/config");

  const clubId = ctx.clubIds[0];
  let club = {} as Record<string, string | null>;
  let loadError: string | null = null;
  try {
    const { data: clubRaw, error } = await supabase
      .from(DB_TABLES.clubs)
      .select("*")
      .eq("id", clubId)
      .maybeSingle();
    if (error) throw error;
    club = (clubRaw ?? {}) as Record<string, string | null>;
  } catch (error) {
    console.error("[admin/club] load error", error);
    loadError = "No se pudieron cargar todos los campos del club. Verificá migraciones pendientes.";
    const { data: minimalRaw } = await supabase
      .from(DB_TABLES.clubs)
      .select("name")
      .eq("id", clubId)
      .maybeSingle();
    club = (minimalRaw ?? {}) as Record<string, string | null>;
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-[#0585FC]`}>Configuración del club</p>
        <h1 className={adminTitle}>Información del club</h1>
        <p className={adminSubtitle}>Actualizá datos públicos y de contacto del club.</p>
      </header>
      {loadError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {loadError}
        </div>
      ) : null}
      <ClubForm
        initial={{
          name: club.name ?? "",
          description: club.description ?? "",
          address: club.address ?? "",
          contact_phone: club.contact_phone ?? "",
          business_hours: club.business_hours ?? "",
          logo_url: club.logo_url ?? "",
          cover_image_url: club.cover_image_url ?? "",
          gallery_image_1: club.gallery_image_1 ?? "",
          gallery_image_2: club.gallery_image_2 ?? "",
          gallery_image_3: club.gallery_image_3 ?? "",
        }}
      />
    </div>
  );
}
