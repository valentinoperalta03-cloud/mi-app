import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, ClipboardList, CreditCard, Settings2 } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminPressable, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const GROUPS: Array<{
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  {
    href: "/admin/config/informacion",
    title: "Información del club",
    description: "Datos, horarios, ubicación, fotos, cuenta y cancelación",
    icon: Building2,
  },
  {
    href: "/admin/config/pagos",
    title: "Métodos de pago",
    description: "Mercado Pago, efectivo y transferencia bancaria",
    icon: CreditCard,
  },
  {
    href: "/admin/config/general",
    title: "General",
    description: "Apariencia y soporte",
    icon: Settings2,
  },
  {
    href: "/admin/config/suscripcion",
    title: "Mi suscripción",
    description: "Plan, estado y facturación",
    icon: ClipboardList,
  },
];

export default async function AdminConfigPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

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
        <p className={adminSubtitle}>Elegí qué querés configurar.</p>
      </header>

      <div className={`${adminCard} divide-y divide-[var(--border-default)] p-0`}>
        {GROUPS.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            prefetch
            className={`flex items-center gap-4 p-5 transition hover:bg-slate-50 dark:hover:bg-slate-900/40 ${adminPressable}`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0585FC]/10 text-[#0585FC] dark:bg-sky-500/10 dark:text-sky-400">
              <g.icon size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">{g.title}</p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{g.description}</p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-slate-400" />
          </Link>
        ))}
      </div>
    </div>
  );
}
