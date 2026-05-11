"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, Building2, CalendarCheck, CreditCard, DollarSign, House, LayoutGrid, Settings, Target, Users } from "lucide-react";
import { memo } from "react";
import { usePathname } from "next/navigation";

const desktopLinks = [
  { href: "/admin/dashboard", label: "Inicio", icon: House },
  { href: "/admin/reservas", label: "Reservas", icon: Target },
  { href: "/admin/finanzas", label: "Finanzas", icon: DollarSign },
  { href: "/admin/pagos", label: "Pagos", icon: CreditCard },
  { href: "/admin/analytics", label: "Ocupación", icon: Activity },
  { href: "/admin/turnos-fijos", label: "Turnos", icon: CalendarCheck },
  { href: "/admin/jugadores", label: "Jugadores", icon: Users },
  { href: "/admin/canchas", label: "Canchas", icon: LayoutGrid },
  { href: "/admin/club", label: "Club", icon: Building2 },
  { href: "/admin/config", label: "Config", icon: Settings },
] as const;

type AdminDesktopHeaderProps = {
  logoUrl?: string | null;
  clubName?: string | null;
};

function AdminDesktopHeaderInner({ logoUrl, clubName }: AdminDesktopHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 hidden border-b border-slate-100/80 bg-white/85 backdrop-blur-md md:block dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(180px,1fr)_minmax(0,2fr)] items-center gap-4 px-4 py-3 md:px-8">
        <div className="min-w-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
            <img src={logoUrl} alt={clubName ?? "Club"} className="h-10 w-auto max-w-[180px] object-contain" />
          ) : (
            <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {clubName ?? "Panel del club"}
            </p>
          )}
        </div>
        <nav className="flex flex-nowrap items-center justify-end gap-0.5 overflow-hidden" aria-label="Modulos">
          {desktopLinks.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/admin/dashboard"
                ? pathname === "/admin/dashboard" || pathname === "/admin"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`relative inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold touch-manipulation transition-transform duration-150 hover:scale-[1.02] active:scale-[0.96] ${
                  active ? "text-[#0461C4] dark:text-sky-400" : "text-slate-600 hover:bg-slate-50 hover:text-[#0585FC] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-400"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="admin-desktop-nav-pill"
                    className="absolute inset-0 -z-10 rounded-2xl bg-[#0585FC]/10/85 ring-1 ring-[#0585FC]/20/50"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <Icon size={16} strokeWidth={2} className={active ? "text-[#0585FC] dark:text-sky-400" : "text-slate-400 dark:text-slate-500"} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export default memo(AdminDesktopHeaderInner);
