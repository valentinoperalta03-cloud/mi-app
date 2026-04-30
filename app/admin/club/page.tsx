import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import ClubForm from "./club-form";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

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
      .select("name,description,address,contact_phone,business_hours,logo_url,cover_image_url,gallery_image_1,gallery_image_2,gallery_image_3")
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

  async function updateClubInfo(formData: FormData) {
    "use server";
    try {
      const supabaseAction = await createClient({ allowCookieWrites: true });
      const actionCtx = await getOwnerAdminContext(supabaseAction);
      if (!actionCtx?.userId || !actionCtx.clubIds.length) redirect("/login");
      const ownClubId = actionCtx.clubIds[0];

      const payload = {
        name: getField(formData, "name") || null,
        description: getField(formData, "description") || null,
        address: getField(formData, "address") || null,
        contact_phone: getField(formData, "contact_phone") || null,
        business_hours: getField(formData, "business_hours") || null,
        logo_url: getField(formData, "logo_url") || null,
        cover_image_url: getField(formData, "cover_image_url") || null,
        gallery_image_1: getField(formData, "gallery_image_1") || null,
        gallery_image_2: getField(formData, "gallery_image_2") || null,
        gallery_image_3: getField(formData, "gallery_image_3") || null,
      };

      const { error } = await supabaseAction
        .from(DB_TABLES.clubs)
        .update(payload)
        .eq("id", ownClubId)
        .eq("owner_id", actionCtx.userId);
      if (error) {
        await supabaseAction
          .from(DB_TABLES.clubs)
          .update({ name: payload.name })
          .eq("id", ownClubId)
          .eq("owner_id", actionCtx.userId);
      }
    } catch (error) {
      console.error("[admin/club] update error", error);
    }

    revalidatePath("/admin/club");
    redirect("/admin/club?saved=1");
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
        action={updateClubInfo}
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
