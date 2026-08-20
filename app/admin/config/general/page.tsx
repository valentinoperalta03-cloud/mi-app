import { redirect } from "next/navigation";
import { Lock, Mail, MessageCircle } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import AdminPageHeader from "@/components/admin/admin-page-header";
import ThemeToggleButton from "@/components/theme-toggle-button";
import { adminAccentBar, adminCard, adminCTAPrimary, adminKicker } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import { updateFinancePin } from "../../finanzas/actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ pin_saved?: string; pin_error?: string }>;
};

export default async function AdminConfigGeneralPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const clubId = ctx.clubIds[0];
  // finance_pin esta revocada para anon/authenticated: se lee con service client.
  const { data: clubRow } = clubId
    ? await createServiceClient()
        .from(DB_TABLES.clubs)
        .select("finance_pin")
        .eq("id", clubId)
        .eq("owner_id", ctx.userId)
        .maybeSingle()
    : { data: null };
  const hasFinancePin = Boolean(String((clubRow as { finance_pin?: string | null } | null)?.finance_pin ?? "").trim());

  const decode = (key?: string) => (key ? decodeURIComponent(key) : "");
  const pinOk = sp.pin_saved === "1";
  const pinErr = decode(sp.pin_error);

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/config" label="Volver a Configuración" />
      <AdminPageHeader
        kicker="Configuración"
        title="General"
        subtitle="Preferencias de la aplicación"
      />

      <section className={`${adminCard} ${adminAccentBar} p-6`}>
        <h2 className="font-admin-display text-base font-bold text-[var(--text-primary)]">Apariencia</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">Elegí modo claro u oscuro para el panel.</p>
        <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-4">
          <ThemeToggleButton />
        </div>
      </section>

      <section className={`${adminCard} p-6`}>
        <h2 className="font-admin-display flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
          <Lock size={18} />
          PIN de análisis
        </h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Protege las secciones Finanzas, Ocupación y Jugadores.
        </p>

        {pinOk ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            Cambios guardados correctamente.
          </p>
        ) : null}
        {pinErr ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            {pinErr}
          </p>
        ) : null}

        <form action={updateFinancePin} className="mt-4 grid gap-3 sm:grid-cols-2">
          {hasFinancePin ? (
            <label className="sm:col-span-2">
              <span className={adminKicker}>PIN actual</span>
              <input
                name="current_pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{4,6}"
                required
                className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm"
              />
            </label>
          ) : null}
          <label>
            <span className={adminKicker}>{hasFinancePin ? "Nuevo PIN" : "PIN"}</span>
            <input
              name="new_pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              pattern="\d{4,6}"
              required
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className={adminKicker}>Confirmar PIN</span>
            <input
              name="confirm_pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              pattern="\d{4,6}"
              required
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className={adminCTAPrimary}>
              {hasFinancePin ? "Cambiar PIN" : "Crear PIN"}
            </button>
          </div>
        </form>
      </section>

      <section className={`${adminCard} p-6`}>
        <h2 className="font-admin-display text-base font-bold text-[var(--text-primary)]">Soporte</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">¿Necesitás ayuda con PadeLibre?</p>
        <div className="mt-4 rounded-2xl border border-[#0085FC]/20 bg-[#0085FC]/10 p-4 dark:border-sky-700/40 dark:bg-sky-950/30">
          <div className="flex flex-wrap gap-2">
            <a
              href="mailto:soporte.padelibre@gmail.com"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-card)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]"
            >
              <Mail size={16} />
              soporte.padelibre@gmail.com
            </a>
            <a
              href="https://wa.me/5493413741000"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-card)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]"
            >
              <MessageCircle size={16} />
              +54 9 341 374-1000
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
