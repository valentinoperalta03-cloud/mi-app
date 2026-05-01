import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import ClubForm from "./club-form";

function logSupabaseError(prefix: string, err: unknown) {
  if (err && typeof err === "object" && "message" in err) {
    const e = err as { message?: string; code?: string; details?: string; hint?: string };
    console.error(prefix, { message: e.message, code: e.code, details: e.details, hint: e.hint });
    return;
  }
  console.error(prefix, err);
}

export default async function AdminClubPage() {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  console.log("[admin/club] getOwnerAdminContext", JSON.stringify(ctx));

  if (!ctx?.userId) {
    console.log("[admin/club] sin ctx.userId, redirect /login");
    redirect("/login");
  }
  if (!ctx.clubIds.length) {
    console.log("[admin/club] sin clubIds, redirect /admin/config", { userId: ctx.userId, clubs: ctx.clubs });
    redirect("/admin/config");
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
    console.log("[admin/club] clubs query (full row)", {
      clubId,
      table: DB_TABLES.clubs,
      hasData: clubRaw != null,
      dataKeys: clubRaw && typeof clubRaw === "object" ? Object.keys(clubRaw as object) : [],
      data: clubRaw,
    });
    if (error) {
      logSupabaseError("[admin/club] clubs query error", error);
      throw error;
    }
    club = (clubRaw ?? {}) as Record<string, string | null>;
  } catch (error) {
    console.error("[admin/club] load error (catch)", error);
    logSupabaseError("[admin/club] load error (parsed)", error);
    loadError = "No se pudieron cargar todos los campos del club. Verificá migraciones pendientes.";
    const { data: minimalRaw, error: minimalError } = await supabase
      .from(DB_TABLES.clubs)
      .select("name")
      .eq("id", clubId)
      .maybeSingle();
    console.log("[admin/club] clubs fallback query (name only)", {
      clubId,
      hasData: minimalRaw != null,
      name: minimalRaw?.name ?? null,
    });
    if (minimalError) logSupabaseError("[admin/club] clubs fallback query error", minimalError);
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
