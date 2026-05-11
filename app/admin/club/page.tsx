import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import ClubForm from "./club-form";

export const dynamic = "force-dynamic";

const NO_CLUB_MSG =
  "No tenés un club asignado. Contactá a soporte.padelibre@gmail.com";

const CLUB_ADMIN_COLUMNS =
  "id,name,location,description,address,contact_phone,whatsapp,instagram,business_hours,logo_url,cover_image_url,gallery_image_1,gallery_image_2,gallery_image_3,gallery_image_4,cancellation_policy,cancellation_hours,owner_id" as const;

function formatSupabaseUserMessage(err: {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}): string {
  const parts = [err.message];
  if (err.code) parts.push(`código ${err.code}`);
  if (err.details) parts.push(err.details);
  if (err.hint) parts.push(`Sugerencia: ${err.hint}`);
  return parts.join(" — ");
}

/**
 * Lee el club del dueño con el cliente de sesión; si falla o no hay fila (p. ej. RLS / caché),
 * reintenta con service role filtrando siempre owner_id (misma verificación que el panel).
 */
async function fetchClubRowForOwner(
  userSupabase: SupabaseClient,
  clubId: string,
  ownerUserId: string
): Promise<{ row: Record<string, string | null> & { cancellation_hours?: number | null }; errorMsg: string | null }> {
  const q1 = await userSupabase
    .from(DB_TABLES.clubs)
    .select(CLUB_ADMIN_COLUMNS)
    .eq("id", clubId)
    .eq("owner_id", ownerUserId)
    .maybeSingle();

  if (!q1.error && q1.data) {
    return {
      row: q1.data as Record<string, string | null> & { cancellation_hours?: number | null },
      errorMsg: null,
    };
  }

  if (q1.error) {
    console.error("[admin/club] clubs query (user client)", {
      message: q1.error.message,
      code: q1.error.code,
      details: q1.error.details,
      hint: q1.error.hint,
    });
  } else {
    console.warn("[admin/club] clubs query returned no row with user client; retrying with service client", {
      clubId,
      ownerUserId,
    });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      row: {},
      errorMsg: q1.error
        ? formatSupabaseUserMessage(q1.error)
        : "No se pudo cargar el club. Falta SUPABASE_SERVICE_ROLE_KEY en el servidor o revisá permisos RLS.",
    };
  }

  const service = createServiceClient();
  const q2 = await service
    .from(DB_TABLES.clubs)
    .select(CLUB_ADMIN_COLUMNS)
    .eq("id", clubId)
    .eq("owner_id", ownerUserId)
    .maybeSingle();

  if (q2.error) {
    console.error("[admin/club] clubs query (service client)", {
      message: q2.error.message,
      code: q2.error.code,
      details: q2.error.details,
      hint: q2.error.hint,
    });
    return { row: {}, errorMsg: formatSupabaseUserMessage(q2.error) };
  }

  if (!q2.data) {
    return {
      row: {},
      errorMsg:
        "No se encontró el club o no tenés permiso para verlo. Verificá que seas el titular (owner_id) en Supabase.",
    };
  }

  return {
    row: q2.data as Record<string, string | null> & { cancellation_hours?: number | null },
    errorMsg: null,
  };
}

function ClubLoadError({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-[#0585FC]`}>Configuración del club</p>
        <h1 className={adminTitle}>Información del club</h1>
      </header>
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
        {message}
      </div>
    </div>
  );
}

type PageProps = {
  searchParams?: Promise<{ saved?: string; error?: string }>;
};

export default async function AdminClubPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const saved = sp.saved === "1";
  const actionErrorKey = sp.error?.trim() ?? "";

  const supabase = await createClient();
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
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {NO_CLUB_MSG}
        </div>
      </div>
    );
  }

  const clubId = ctx.clubIds[0];
  const { row: club, errorMsg } = await fetchClubRowForOwner(supabase, clubId, ctx.userId);

  if (errorMsg) {
    return <ClubLoadError message={errorMsg} />;
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
      <a href={`/clubes/${clubId}`} target="_blank" rel="noreferrer" className="text-[#0585FC] text-sm font-semibold">
        Ver cómo te ven los jugadores →
      </a>
      {saved ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          Cambios guardados correctamente.
        </div>
      ) : null}
      {actionErrBanner ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
          {actionErrBanner}
        </div>
      ) : null}
      <ClubForm
        clubId={clubId}
        initial={{
          name: club.name ?? "",
          location: club.location ?? "",
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
          cancellation_hours:
            typeof club.cancellation_hours === "number" && Number.isFinite(club.cancellation_hours)
              ? club.cancellation_hours
              : null,
        }}
      />
    </div>
  );
}
