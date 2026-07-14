import { redirect } from "next/navigation";
import { Mail, MessageCircle } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import ThemeToggleButton from "@/components/theme-toggle-button";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminConfigGeneralPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/config" label="Volver a Configuración" />
      <header className="space-y-2">
        <p className={adminKicker}>Configuración</p>
        <h1 className={adminTitle}>General</h1>
        <p className={adminSubtitle}>Apariencia y soporte.</p>
      </header>

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
            <a
              href="mailto:soporte.padelibre@gmail.com"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:bg-slate-900 dark:text-slate-100"
            >
              <Mail size={16} />
              soporte.padelibre@gmail.com
            </a>
            <a
              href="https://wa.me/5493412571953"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:bg-slate-900 dark:text-slate-100"
            >
              <MessageCircle size={16} />
              +54 9 341 257-1953
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
