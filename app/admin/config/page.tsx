import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, ClipboardList, CreditCard, Settings2 } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import { AdminSignOutLink } from "@/components/admin/admin-sign-out-link";
import {
  adminAccentBar,
  adminCard,
  adminKicker,
  adminPressable,
  adminSubtitle,
  adminTitle,
} from "@/components/admin/admin-premium";
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
    description: "Datos, horarios, ubicación, fotos y política de cancelación",
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
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--bg-subtle)] text-[var(--text-tertiary)] ring-1 ring-[var(--border-subtle)]">
            <Settings2 size={24} />
          </span>
          Configuración del club
        </h1>
        <p className={adminSubtitle}>Elegí qué querés configurar.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {GROUPS.map((g, i) => (
          <Link
            key={g.href}
            href={g.href}
            prefetch
            className={`${adminCard} ${adminPressable} flex items-center gap-4 ${i === GROUPS.length - 1 ? adminAccentBar : ""}`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <g.icon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-[var(--text-primary)]">{g.title}</p>
              <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{g.description}</p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-[var(--text-tertiary)]" />
          </Link>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <AdminSignOutLink />
      </div>
    </div>
  );
}
