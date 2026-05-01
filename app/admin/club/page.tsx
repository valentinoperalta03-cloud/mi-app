import { redirect, unstable_rethrow } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import ClubForm from "./club-form";

const NO_CLUB_MSG =
  "No tenés un club asignado. Contactá a soporte.padelibre@gmail.com";

function logSupabaseError(prefix: string, err: unknown) {
  if (err && typeof err === "object" && "message" in err) {
    const e = err as { message?: string; code?: string; details?: string; hint?: string };
    console.error(prefix, { message: e.message, code: e.code, details: e.details, hint: e.hint });
    return;
  }
  console.error(prefix, err);
}

type PageProps = {
  searchParams?: Promise<{ saved?: string; error?: string }>;
};

export default async function AdminClubPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const saved = sp.saved === "1";
  const actionErrorKey = sp.error?.trim() ?? "";

  try {
    const supabase = await createClient({ allowCookieWrites: true });
    const ctx = await getOwnerAdminContext(supabase);

    if (!ctx?.userId) {
      redirect("/login");
    }

    if (ctx.clubIds.length === 0) {
      return (
        <div className="flex flex-col gap-6">
          <AdminBackLink />
          <header className="space-y-2">
            <p className={`${adminKicker} text-[#0585FC]`}>Configuración del club</p>
            <h1 className={adminTitle}>Información del club</h1>
            <p className={adminSubtitle}>Actualizá datos públicos y de contacto del club.</p>
          </header>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {NO_CLUB_MSG}
          </div>
        </div>
      );
    }

    const clubId = ctx.clubIds[0];
    let club = {} as Record<string, string | null>;
    let loadError: string | null = null;

    try {
      const { data: clubRaw, error } = await supabase
        .from(DB_TABLES.clubs)
        .select("*")
        .eq("id", clubId)
        .maybeSingle();
      if (error) {
        logSupabaseError("[admin/club] clubs query error", error);
        throw error;
      }
      club = (clubRaw ?? {}) as Record<string, string | null>;
    } catch (error) {
      console.error("[admin/club] load error", error);
      loadError = "No se pudieron cargar todos los campos del club. Verificá migraciones pendientes.";
      const { data: minimalRaw, error: minimalError } = await supabase
        .from(DB_TABLES.clubs)
        .select("name")
        .eq("id", clubId)
        .maybeSingle();
      if (minimalError) logSupabaseError("[admin/club] clubs fallback query error", minimalError);
      club = (minimalRaw ?? {}) as Record<string, string | null>;
    }

    let actionErrBanner = "";
    if (actionErrorKey === "no_club") {
      actionErrBanner = NO_CLUB_MSG;
    } else if (actionErrorKey) {
      try {
        actionErrBanner = decodeURIComponent(actionErrorKey.replace(/\+/g, " "));
      } catch {
        actionErrBanner = actionErrorKey;
      }
    }

    return (
      <div className="flex flex-col gap-6">
        <AdminBackLink />
        <header className="space-y-2">
          <p className={`${adminKicker} text-[#0585FC]`}>Configuración del club</p>
          <h1 className={adminTitle}>Información del club</h1>
          <p className={adminSubtitle}>Actualizá datos públicos y de contacto del club.</p>
        </header>
        {saved ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Cambios guardados correctamente.
          </div>
        ) : null}
        {actionErrBanner ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            {actionErrBanner}
          </div>
        ) : null}
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
            whatsapp: club.whatsapp ?? "",
            instagram: club.instagram ?? "",
            business_hours: club.business_hours ?? "",
            logo_url: club.logo_url ?? "",
            cover_image_url: club.cover_image_url ?? "",
            gallery_image_1: club.gallery_image_1 ?? "",
            gallery_image_2: club.gallery_image_2 ?? "",
            gallery_image_3: club.gallery_image_3 ?? "",
            gallery_image_4: club.gallery_image_4 ?? "",
            cancellation_policy: club.cancellation_policy ?? "",
          }}
        />
      </div>
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error("[admin/club] page error", error);
    return (
      <div className="flex flex-col gap-6">
        <AdminBackLink />
        <header className="space-y-2">
          <p className={`${adminKicker} text-[#0585FC]`}>Configuración del club</p>
          <h1 className={adminTitle}>Información del club</h1>
        </header>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          Ocurrió un error al cargar esta página. Intentá de nuevo más tarde o contactá a soporte.padelibre@gmail.com
        </div>
      </div>
    );
  }
}
