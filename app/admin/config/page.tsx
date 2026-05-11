import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle, LogOut, Settings2 } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import ThemeToggleButton from "@/components/theme-toggle-button";
import {
  adminCard,
  adminKicker,
  adminPressable,
  adminSubtitle,
  adminTitle,
} from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

async function signOutAction() {
  "use server";
  const supabase = await createClient({ allowCookieWrites: true });
  await supabase.auth.signOut();
  redirect("/login");
}

async function updateFinancePin(formData: FormData) {
  "use server";
  const currentPin = String(formData.get("current_pin") ?? "").trim();
  const newPin = String(formData.get("new_pin") ?? "").trim();
  const confirmPin = String(formData.get("confirm_pin") ?? "").trim();

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length) redirect("/admin/config?pin_error=no_club");

  const clubId = ctx.clubIds[0];
  const { data: clubRow } = await supabase
    .from(DB_TABLES.clubs)
    .select("finance_pin")
    .eq("id", clubId)
    .maybeSingle();

  const storedPin = String((clubRow as { finance_pin?: string | null } | null)?.finance_pin ?? "").trim();
  const fallbackPin = String(process.env.NEXT_PUBLIC_ADMIN_FINANCE_PIN ?? "1234").trim();
  const expectedCurrent = storedPin || fallbackPin;

  if (!/^\d{6}$/.test(newPin)) {
    redirect("/admin/config?pin_error=El+nuevo+PIN+debe+tener+6+d%C3%ADgitos.");
  }
  if (newPin !== confirmPin) {
    redirect("/admin/config?pin_error=La+confirmaci%C3%B3n+del+PIN+no+coincide.");
  }
  if (currentPin !== expectedCurrent) {
    redirect("/admin/config?pin_error=El+PIN+actual+es+incorrecto.");
  }

  const { error } = await supabase.from(DB_TABLES.clubs).update({ finance_pin: newPin }).eq("id", clubId).eq("owner_id", ctx.userId);
  if (error) {
    redirect(`/admin/config?pin_error=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin/config?pin_saved=1");
}

type PageProps = {
  searchParams?: Promise<{ pin_saved?: string; pin_error?: string }>;
};

export default async function AdminConfigPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: authData } = await supabase.auth.getUser();
  const userEmail = authData.user?.email ?? "—";

  const { data: clubData } = ctx.clubIds.length
    ? await supabase
        .from(DB_TABLES.clubs)
        .select("name,mp_access_token,mp_user_id,finance_pin")
        .eq("id", ctx.clubIds[0])
        .maybeSingle()
    : { data: null };
  const typedClub = clubData as {
    name?: string | null;
    mp_access_token?: string | null;
    mp_user_id?: string | null;
    finance_pin?: string | null;
  } | null;
  const isMpConnected = Boolean(typedClub?.mp_access_token);
  const mpUserId = typedClub?.mp_user_id ?? "—";
  const clubName = typedClub?.name ?? "Club";
  const clubId = ctx.clubIds[0] ?? "";
  const clubIdShort = clubId ? clubId.slice(-8) : "—";
  const pinSaved = sp.pin_saved === "1";
  const pinError = sp.pin_error ? decodeURIComponent(sp.pin_error) : "";

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={adminKicker}>Configuración</p>
        <h1 className={`${adminTitle} flex flex-wrap items-center gap-3`}>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/60">
            <Settings2 size={24} strokeWidth={2} aria-hidden />
          </span>
          Configuración del club
        </h1>
        <p className={adminSubtitle}>Configuraciones generales de tu cuenta y del club.</p>
      </header>

      <section className={adminCard}>
        <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">Cuenta</h2>
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-slate-600 dark:text-slate-300">
            <span className="font-semibold">Email:</span> {userEmail}
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            <span className="font-semibold">Club:</span> {clubName}
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            <span className="font-semibold">ID del club:</span> {clubIdShort}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <Link
          href="/admin/config/mp-connect"
          className={`group flex h-full flex-col rounded-2xl border p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(16,185,129,0.1)] transition-all duration-300 ${adminPressable} hover:-translate-y-0.5 hover:shadow-lg ${
            isMpConnected
              ? "border-emerald-200/70 bg-gradient-to-br from-emerald-500/10 to-teal-500/8 hover:border-emerald-300/80"
              : "border-amber-200/70 bg-gradient-to-br from-amber-500/10 to-yellow-500/8 hover:border-amber-300/80"
          }`}
        >
          <div className="flex items-center gap-2">
            {isMpConnected ? (
              <CheckCircle size={18} className="text-emerald-600" />
            ) : (
              <AlertCircle size={18} className="text-amber-600" />
            )}
            <p className={`text-sm font-semibold ${isMpConnected ? "text-emerald-700" : "text-amber-700"}`}>
              {isMpConnected ? "Mercado Pago conectado ✓" : "Sin conectar"}
            </p>
          </div>
          <p className="mt-2 text-base font-bold text-slate-900">Mercado Pago</p>
          <p className="mt-2 flex-1 text-sm font-medium leading-relaxed text-slate-600">
            {isMpConnected
              ? `Cuenta activa. MP User ID: ${mpUserId}`
              : "Conectá la cuenta del club para cobrar reservas con split de comisión."}
          </p>
          <span className={`mt-5 text-sm font-semibold ${isMpConnected ? "text-emerald-600 group-hover:text-emerald-500" : "text-amber-600 group-hover:text-amber-500"}`}>
            {isMpConnected ? "Reconectar" : "Conectar"}
          </span>
        </Link>
      </section>

      <section className={adminCard}>
        <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">PIN de finanzas</h2>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          Cambiá el PIN del módulo financiero. Se guarda en tu club y aplica sin redeploy.
        </p>
        {pinSaved ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            PIN actualizado correctamente.
          </p>
        ) : null}
        {pinError ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            {pinError}
          </p>
        ) : null}
        <form action={updateFinancePin} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">PIN actual</span>
            <input
              name="current_pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Nuevo PIN (6 dígitos)</span>
            <input
              name="new_pin"
              type="password"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Confirmar nuevo PIN</span>
            <input
              name="confirm_pin"
              type="password"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
              Cambiar PIN
            </button>
          </div>
        </form>
      </section>

      <section className={adminCard}>
        <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">Apariencia</h2>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">Personalizá el modo claro/oscuro del panel.</p>
        <div className="mt-4">
          <ThemeToggleButton />
        </div>
      </section>
      <section className={adminCard}>
        <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">Soporte</h2>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">¿Necesitás ayuda? Contactá a PadeLibre</p>
        <div className="mt-3 space-y-1 text-sm">
          <p className="text-slate-700 dark:text-slate-200">Email: soporte.padelibre@gmail.com</p>
          <a
            href="https://wa.me/5493412571953"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#0585FC]"
          >
            WhatsApp de soporte
          </a>
        </div>
      </section>

      <section className={adminCard}>
        <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">Sesión</h2>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">Podés cerrar sesión del panel admin.</p>
        <form action={signOutAction} className="mt-4">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </form>
      </section>
    </div>
  );
}
