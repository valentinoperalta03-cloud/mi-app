import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle, Lock, LogOut, Mail, MessageCircle, Settings2 } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import ThemeToggleButton from "@/components/theme-toggle-button";
import { adminCard, adminKicker, adminPressable, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import ClubForm from "../club/club-form";
import { updateFinancePin } from "./actions";

const NO_CLUB_MSG = "No tenés un club asignado. Contactá a soporte.padelibre@gmail.com";
const CLUB_ADMIN_COLUMNS =
  "id,name,location,description,address,contact_phone,whatsapp,instagram,business_hours,logo_url,cover_image_url,gallery_image_1,gallery_image_2,gallery_image_3,gallery_image_4,cancellation_policy,cancellation_hours,owner_id,mp_access_token,mp_user_id,finance_pin,accepts_cash,accepts_transfer,bank_alias,bank_cbu" as const;
const CLUB_ADMIN_COLUMNS_FALLBACK =
  "id,name,location,description,address,contact_phone,whatsapp,instagram,business_hours,logo_url,cover_image_url,gallery_image_1,gallery_image_2,gallery_image_3,gallery_image_4,cancellation_policy,owner_id,mp_access_token,mp_user_id,finance_pin,accepts_cash,accepts_transfer,bank_alias,bank_cbu" as const;

async function signOutAction() {
  "use server";
  const supabase = await createClient({ allowCookieWrites: true });
  await supabase.auth.signOut();
  redirect("/login");
}

type PageProps = {
  searchParams?: Promise<{ saved?: string; error?: string; pin_saved?: string; pin_error?: string }>;
};

export default async function AdminConfigPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: authData } = await supabase.auth.getUser();
  const userEmail = authData.user?.email ?? "—";

  if (!ctx.clubIds.length) {
    return (
      <div className="flex flex-col gap-6">
        <AdminBackLink />
        <header className="space-y-2">
          <p className={adminKicker}>Configuración</p>
          <h1 className={adminTitle}>Configuración del club</h1>
          <p className={adminSubtitle}>Centralizá toda la configuración de tu club en un solo lugar.</p>
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

  // Compat: algunos entornos aún no tienen cancellation_hours en clubs.
  if (clubErr?.message?.toLowerCase().includes("cancellation_hours")) {
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
        <AdminBackLink />
        <header className="space-y-2">
          <p className={adminKicker}>Configuración</p>
          <h1 className={adminTitle}>Configuración del club</h1>
        </header>
        <div className={`${adminCard} p-6 text-sm font-medium text-rose-700`}>
          {clubErr?.message ?? "No se pudo cargar el club."}
        </div>
      </div>
    );
  }

  const club = clubRaw as {
    name: string | null;
    location: string | null;
    description: string | null;
    address: string | null;
    contact_phone: string | null;
    whatsapp: string | null;
    instagram: string | null;
    business_hours: string | null;
    logo_url: string | null;
    cover_image_url: string | null;
    gallery_image_1: string | null;
    gallery_image_2: string | null;
    gallery_image_3: string | null;
    gallery_image_4: string | null;
    cancellation_policy: string | null;
    cancellation_hours: number | null;
    mp_access_token: string | null;
    mp_user_id: string | null;
    finance_pin: string | null;
    accepts_cash?: boolean | null;
    accepts_transfer?: boolean | null;
    bank_alias?: string | null;
    bank_cbu?: string | null;
  };

  const isMpConnected = Boolean(club.mp_access_token);
  const saved = sp.saved === "1";
  const pinSaved = sp.pin_saved === "1";
  const actionErr = sp.error ? decodeURIComponent(sp.error) : "";
  const pinErr = sp.pin_error ? decodeURIComponent(sp.pin_error) : "";
  const clubName = club.name ?? "Club";
  const clubShortId = clubId.slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={adminKicker}>Configuración</p>
        <h1 className={`${adminTitle} flex items-center gap-3`}>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/60 dark:bg-slate-800 dark:ring-slate-700">
            <Settings2 size={24} />
          </span>
          Configuración del club
        </h1>
        <p className={adminSubtitle}>Centralizá toda la configuración de tu club en un solo lugar.</p>
      </header>

      <section className={`${adminCard} p-6`}>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Cuenta</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Datos principales de tu club y sesión.</p>
        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/10 p-4 dark:border-sky-700/40 dark:bg-sky-950/30">
          {club.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen pública de club
            <img src={club.logo_url} alt={clubName} className="h-14 w-14 rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
          ) : (
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0585FC]/20 text-lg font-bold text-[#0461C4] dark:text-sky-300">
              {clubName.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">{clubName}</p>
            <p className="truncate text-sm text-slate-600 dark:text-slate-300">{userEmail}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">ID del club: {clubShortId}</p>
          </div>
        </div>
      </section>

      <section className={`${adminCard} p-6`}>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Información del club</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Editá nombre, fotos, contacto y política de cancelación.</p>
        {saved ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            Cambios guardados correctamente.
          </p>
        ) : null}
        {actionErr ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            {actionErr}
          </p>
        ) : null}
        <div className="mt-4">
          <ClubForm
            clubId={clubId}
            isMpConnected={isMpConnected}
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
                typeof club.cancellation_hours === "number" && Number.isFinite(club.cancellation_hours) ? club.cancellation_hours : null,
              accepts_cash: Boolean(club.accepts_cash),
              accepts_transfer: Boolean(club.accepts_transfer),
              bank_alias: club.bank_alias ?? "",
              bank_cbu: club.bank_cbu ?? "",
            }}
          />
        </div>
      </section>

      <section className={`${adminCard} p-6`}>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Mercado Pago</h2>
        <Link
          href="/admin/config/mp-connect"
          className={`mt-4 block rounded-2xl border p-5 transition ${adminPressable} ${
            isMpConnected
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
              : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
          }`}
        >
          <div className="flex items-center gap-2">
            {isMpConnected ? <CheckCircle size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-amber-600" />}
            <p className={`text-sm font-semibold ${isMpConnected ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
              {isMpConnected ? "Conectado" : "Desconectado"}
            </p>
          </div>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            {isMpConnected ? `MP User ID: ${club.mp_user_id ?? "—"}` : "Conectá tu cuenta para cobrar reservas."}
          </p>
          <span className="mt-3 inline-flex rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 dark:bg-slate-900 dark:text-slate-200">
            {isMpConnected ? "Reconectar" : "Conectar ahora"}
          </span>
        </Link>
      </section>

      <section className={`${adminCard} p-6`}>
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
          <Lock size={18} />
          PIN de finanzas
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Protegé el módulo financiero con un PIN de 4 a 6 dígitos.</p>
        {pinSaved ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            PIN actualizado correctamente.
          </p>
        ) : null}
        {pinErr ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            {pinErr}
          </p>
        ) : null}
        <form action={updateFinancePin} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">PIN actual</span>
            <input name="current_pin" type="password" inputMode="numeric" maxLength={6} pattern="\d{4,6}" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Nuevo PIN</span>
            <input name="new_pin" type="password" inputMode="numeric" maxLength={6} pattern="\d{4,6}" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Confirmar PIN</span>
            <input name="confirm_pin" type="password" inputMode="numeric" maxLength={6} pattern="\d{4,6}" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
              Cambiar PIN
            </button>
          </div>
        </form>
      </section>

      <section className={`${adminCard} p-6`}>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Apariencia</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Elegí modo claro u oscuro para el panel.</p>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <ThemeToggleButton />
        </div>
      </section>

      <section className={`${adminCard} p-6`}>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Soporte</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">¿Necesitás ayuda con PadeLibre?</p>
        <div className="mt-4 rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/10 p-4 dark:border-sky-700/40 dark:bg-sky-950/30">
          <div className="flex flex-wrap gap-2">
            <a href="mailto:soporte.padelibre@gmail.com" className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:bg-slate-900 dark:text-slate-100">
              <Mail size={16} />
              soporte.padelibre@gmail.com
            </a>
            <a href="https://wa.me/5493412571953" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:bg-slate-900 dark:text-slate-100">
              <MessageCircle size={16} />
              +54 9 341 257-1953
            </a>
          </div>
        </div>
      </section>

      <section className={`${adminCard} p-6`}>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Sesión</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Conectado como {clubName} ({userEmail})</p>
        <form action={signOutAction} className="mt-4">
          <button type="submit" className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </form>
      </section>
    </div>
  );
}
