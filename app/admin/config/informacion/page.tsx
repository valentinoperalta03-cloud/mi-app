import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminAccentBar, adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import ConfigCancellationForm from "../config-cancellation-form";
import ConfigClubDataForm from "../config-club-data-form";
import ConfigClubLocationForm from "../config-club-location-form";
import ConfigClubPhotosForm from "../config-club-photos-form";
import ClubHoursForm from "../club-hours-form";

export const dynamic = "force-dynamic";

const NO_CLUB_MSG = "No tenés un club asignado. Contactá a soporte.padelibre@gmail.com";
const CLUB_ADMIN_COLUMNS =
  "id,name,location,city,province,country,description,address,contact_phone,whatsapp,instagram,business_hours,open_time,close_time,logo_url,cover_image_url,gallery_image_1,gallery_image_2,gallery_image_3,gallery_image_4,cancellation_policy,cancellation_hours,owner_id" as const;
const CLUB_ADMIN_COLUMNS_FALLBACK =
  "id,name,location,description,address,contact_phone,whatsapp,instagram,business_hours,open_time,close_time,logo_url,cover_image_url,gallery_image_1,gallery_image_2,gallery_image_3,gallery_image_4,cancellation_policy,owner_id" as const;

async function signOutAction() {
  "use server";
  const supabase = await createClient({ allowCookieWrites: true });
  await supabase.auth.signOut();
  redirect("/login");
}

function flash(ok: boolean, err: string) {
  if (ok) {
    return (
      <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
        Cambios guardados correctamente.
      </p>
    );
  }
  if (err) {
    return (
      <p className="mt-4 rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
        {err}
      </p>
    );
  }
  return null;
}

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
        <header className="space-y-2">
          <p className={adminKicker}>Configuración</p>
          <h1 className={adminTitle}>Información del club</h1>
        </header>
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
    clubErr?.message?.toLowerCase().includes("close_time")
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
        <header className="space-y-2">
          <p className={adminKicker}>Configuración</p>
          <h1 className={adminTitle}>Información del club</h1>
        </header>
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

  const clubName = club.name ?? "Club";
  const clubShortId = clubId.slice(0, 8);
  const clubOpenDefault = String(club.open_time ?? "09:00:00").trim().slice(0, 5);
  const clubCloseDefault = String(club.close_time ?? "23:59:00").trim().slice(0, 5);
  const businessHoursDisplay = club.business_hours ?? `${clubOpenDefault} - ${clubCloseDefault}`;

  const decode = (key?: string) => (key ? decodeURIComponent(key) : "");

  const hoursOk = sp.hours_saved === "1" || sp.saved === "1";
  const hoursErr = decode(sp.hours_error) || decode(sp.error);
  const dataOk = sp.data_saved === "1";
  const dataErr = decode(sp.data_error);
  const locationOk = sp.location_saved === "1";
  const locationErr = decode(sp.location_error);
  const photosOk = sp.photos_saved === "1";
  const photosErr = decode(sp.photos_error);
  const policyOk = sp.policy_saved === "1";
  const policyErr = decode(sp.policy_error);

  const cancellationHours =
    typeof club.cancellation_hours === "number" && Number.isFinite(club.cancellation_hours)
      ? club.cancellation_hours
      : null;

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/config" label="Volver a Configuración" />
      <header className="space-y-2">
        <p className={adminKicker}>Configuración</p>
        <h1 className={adminTitle}>Información del club</h1>
        <p className={adminSubtitle}>Datos, horarios, ubicación, fotos, cuenta y cancelación.</p>
      </header>

      <section className={`${adminCard} ${adminAccentBar} p-6`}>
        <h2 className="font-admin-display text-base font-bold text-[var(--text-primary)]">Cuenta</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">Datos principales de tu club y sesión.</p>
        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/10 p-4 dark:border-sky-700/40 dark:bg-sky-950/30">
          {club.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.logo_url} alt={clubName} className="h-14 w-14 rounded-2xl object-cover ring-1 ring-[var(--border-subtle)]" />
          ) : (
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0585FC]/20 text-lg font-bold text-[#0461C4] dark:text-sky-300">
              {clubName.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-xl font-bold text-[var(--text-primary)]">{clubName}</p>
            <p className="truncate text-sm text-[var(--text-secondary)]">{userEmail}</p>
            <p className="mt-1 text-xs font-semibold text-[var(--text-tertiary)]">ID del club: {clubShortId}</p>
          </div>
        </div>
        <form action={signOutAction} className="mt-4">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </form>
      </section>

      <section className={`${adminCard} p-6`}>
        <h2 className="font-admin-display text-base font-bold text-[var(--text-primary)]">Horarios del club</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Seleccioná la apertura y el cierre del club. Todos los turnos son de 90 minutos y se aplican a todas las canchas automáticamente.
        </p>
        {flash(hoursOk, hoursErr)}
        <ClubHoursForm defaultOpen={clubOpenDefault} />
        <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
          <a
            href="/admin/horarios"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)]"
          >
            Gestionar horarios bloqueados →
          </a>
        </div>
      </section>

      <section className={`${adminCard} p-6`}>
        <h2 className="font-admin-display text-base font-bold text-[var(--text-primary)]">Datos del club</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">Nombre, descripción, dirección y contacto.</p>
        {flash(dataOk, dataErr)}
        <div className="mt-4">
          <ConfigClubDataForm
            initial={{
              name: club.name ?? "",
              description: club.description ?? "",
              address: club.address ?? "",
              contact_phone: club.contact_phone ?? "",
              whatsapp: club.whatsapp ?? "",
              instagram: club.instagram ?? "",
              business_hours: businessHoursDisplay,
            }}
          />
        </div>
      </section>

      <section className={`${adminCard} p-6`}>
        <h2 className="font-admin-display text-base font-bold text-[var(--text-primary)]">Ubicación del club</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Ciudad donde opera el club. Los jugadores solo verán tu club si están en la misma ciudad.
        </p>
        {flash(locationOk, locationErr)}
        <div className="mt-4">
          <ConfigClubLocationForm
            initial={{
              location: club.location ?? null,
              city: club.city ?? null,
              province: club.province ?? null,
              country: club.country ?? null,
            }}
          />
        </div>
      </section>

      <section className={`${adminCard} p-6`}>
        <h2 className="font-admin-display text-base font-bold text-[var(--text-primary)]">Fotos</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">Logo, portada y galería visible para jugadores.</p>
        {flash(photosOk, photosErr)}
        <div className="mt-4">
          <ConfigClubPhotosForm
            clubId={clubId}
            initial={{
              logo_url: club.logo_url ?? "",
              cover_image_url: club.cover_image_url ?? "",
              gallery_image_1: club.gallery_image_1 ?? "",
              gallery_image_2: club.gallery_image_2 ?? "",
              gallery_image_3: club.gallery_image_3 ?? "",
              gallery_image_4: club.gallery_image_4 ?? "",
            }}
          />
        </div>
      </section>

      <section className={`${adminCard} p-6`}>
        <h2 className="font-admin-display text-base font-bold text-[var(--text-primary)]">Política de cancelación</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">Definí hasta cuándo los jugadores pueden cancelar con reembolso.</p>
        {flash(policyOk, policyErr)}
        <div className="mt-4">
          <ConfigCancellationForm
            initialPolicy={club.cancellation_policy ?? ""}
            initialHours={cancellationHours}
          />
        </div>
      </section>
    </div>
  );
}
