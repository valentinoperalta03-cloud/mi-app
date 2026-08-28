import AdminBackLink from "@/components/admin/admin-back-link";
import AdminPageHeader from "@/components/admin/admin-page-header";
import { adminCard } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import InformacionHubClient from "./informacion-hub-client";

export const dynamic = "force-dynamic";

const NO_CLUB_MSG = "No tenés un club asignado. Contactá a soporte.padelibre@gmail.com";
const CLUB_ADMIN_COLUMNS =
  "id,name,location,city,province,country,description,address,contact_phone,whatsapp,instagram,facebook,tiktok,slug,business_hours,open_time,close_time,logo_url,cover_image_url,gallery_image_1,gallery_image_2,gallery_image_3,gallery_image_4,cancellation_policy,cancellation_hours,owner_id" as const;
const CLUB_ADMIN_COLUMNS_FALLBACK =
  "id,name,location,description,address,contact_phone,whatsapp,instagram,business_hours,open_time,close_time,logo_url,cover_image_url,gallery_image_1,gallery_image_2,gallery_image_3,gallery_image_4,cancellation_policy,owner_id" as const;

type ConfigSearchParams = {
  hours_saved?: string;
  hours_error?: string;
  data_saved?: string;
  data_error?: string;
  location_saved?: string;
  location_error?: string;
  photos_saved?: string;
  photos_error?: string;
  policy_saved?: string;
  policy_error?: string;
  saved?: string;
  error?: string;
};

type PageProps = {
  searchParams?: Promise<ConfigSearchParams>;
};

export default async function AdminConfigInformacionPage({ searchParams }: PageProps) {
  const sp: ConfigSearchParams = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: authData } = await supabase.auth.getUser();
  const userEmail = authData.user?.email ?? "—";

  if (!ctx.clubIds.length) {
    return (
      <div className="flex flex-col gap-6">
        <AdminBackLink href="/admin/config" label="Volver a Configuración" />
        <AdminPageHeader kicker="Configuración" title="Información del club" />
        <div className={`${adminCard} p-6 text-sm font-medium text-amber-800`}>{NO_CLUB_MSG}</div>
      </div>
    );
  }

  const clubId = ctx.clubIds[0];
  const firstFetch = await supabase
    .from(DB_TABLES.clubs)
    .select(CLUB_ADMIN_COLUMNS)
    .eq("id", clubId)
    .eq("owner_id", ctx.userId)
    .maybeSingle();
  let clubRaw: Record<string, unknown> | null = (firstFetch.data as Record<string, unknown> | null) ?? null;
  let clubErr = firstFetch.error;

  if (
    clubErr?.message?.toLowerCase().includes("cancellation_hours") ||
    clubErr?.message?.toLowerCase().includes("open_time") ||
    clubErr?.message?.toLowerCase().includes("close_time") ||
    clubErr?.message?.toLowerCase().includes("slug") ||
    clubErr?.message?.toLowerCase().includes("facebook") ||
    clubErr?.message?.toLowerCase().includes("tiktok")
  ) {
    const fallback = await supabase
      .from(DB_TABLES.clubs)
      .select(CLUB_ADMIN_COLUMNS_FALLBACK)
      .eq("id", clubId)
      .eq("owner_id", ctx.userId)
      .maybeSingle();
    clubRaw = (fallback.data as Record<string, unknown> | null) ?? null;
    clubErr = fallback.error;
  }
  if (clubErr || !clubRaw) {
    return (
      <div className="flex flex-col gap-6">
        <AdminBackLink href="/admin/config" label="Volver a Configuración" />
        <AdminPageHeader kicker="Configuración" title="Información del club" />
        <div className={`${adminCard} p-6 text-sm font-medium text-rose-700`}>
          {clubErr?.message ?? "No se pudo cargar el club."}
        </div>
      </div>
    );
  }

  const club = clubRaw as {
    name: string | null;
    location?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    description: string | null;
    address: string | null;
    contact_phone: string | null;
    whatsapp: string | null;
    instagram: string | null;
    facebook?: string | null;
    tiktok?: string | null;
    slug?: string | null;
    business_hours: string | null;
    open_time?: string | null;
    close_time?: string | null;
    logo_url: string | null;
    cover_image_url: string | null;
    gallery_image_1: string | null;
    gallery_image_2: string | null;
    gallery_image_3: string | null;
    gallery_image_4: string | null;
    cancellation_policy: string | null;
    cancellation_hours?: number | null;
  };

  const clubShortId = clubId.slice(0, 8);
  const clubOpenDefault = String(club.open_time ?? "09:00:00").trim().slice(0, 5);
  const clubCloseDefault = String(club.close_time ?? "23:59:00").trim().slice(0, 5);
  const businessHoursDisplay = club.business_hours ?? `${clubOpenDefault} - ${clubCloseDefault}`;

  const decode = (key?: string) => (key ? decodeURIComponent(key) : "");

  const cancellationHours =
    typeof club.cancellation_hours === "number" && Number.isFinite(club.cancellation_hours)
      ? club.cancellation_hours
      : null;

  return (
    <InformacionHubClient
      clubId={clubId}
      clubShortId={clubShortId}
      userEmail={userEmail}
      club={{
        name: club.name ?? "",
        description: club.description ?? "",
        address: club.address ?? "",
        contact_phone: club.contact_phone ?? "",
        whatsapp: club.whatsapp ?? "",
        instagram: club.instagram ?? "",
        facebook: club.facebook ?? "",
        tiktok: club.tiktok ?? "",
        business_hours: businessHoursDisplay,
        slug: club.slug ?? "",
        logo_url: club.logo_url ?? "",
        cover_image_url: club.cover_image_url ?? "",
        gallery_image_1: club.gallery_image_1 ?? "",
        gallery_image_2: club.gallery_image_2 ?? "",
        gallery_image_3: club.gallery_image_3 ?? "",
        gallery_image_4: club.gallery_image_4 ?? "",
        cancellation_policy: club.cancellation_policy ?? "",
        cancellation_hours: cancellationHours,
        location: club.location ?? null,
        city: club.city ?? null,
        province: club.province ?? null,
        country: club.country ?? null,
      }}
      flash={{
        dataOk: sp.data_saved === "1",
        dataErr: decode(sp.data_error),
        locationOk: sp.location_saved === "1",
        locationErr: decode(sp.location_error),
        photosOk: sp.photos_saved === "1",
        photosErr: decode(sp.photos_error),
        policyOk: sp.policy_saved === "1",
        policyErr: decode(sp.policy_error),
      }}
    />
  );
}
