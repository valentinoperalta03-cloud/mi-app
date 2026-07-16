"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, Banknote, CalendarCheck, CreditCard, DollarSign, GraduationCap, House, LayoutGrid, Settings, Target, Trophy, Users } from "lucide-react";
import { memo } from "react";
import { usePathname } from "next/navigation";
import { isFacturacionPath } from "@/lib/auth-redirect";

const desktopLinks = [
  { href: "/admin/dashboard", label: "Inicio", icon: House },
  { href: "/admin/reservas", label: "Reservas", icon: Target },
  { href: "/admin/finanzas", label: "Finanzas", icon: DollarSign },
  { href: "/admin/pagos", label: "Pagos", icon: CreditCard },
  { href: "/admin/cobros", label: "Cobros", icon: Banknote },
  { href: "/admin/analytics", label: "Ocupación", icon: Activity },
  { href: "/admin/turnos-fijos", label: "Turnos", icon: CalendarCheck },
  { href: "/admin/torneos", label: "Torneos", icon: Trophy },
  { href: "/admin/clases", label: "Clases", icon: GraduationCap },
  { href: "/admin/jugadores", label: "Jugadores", icon: Users },
  { href: "/admin/canchas", label: "Canchas", icon: LayoutGrid },
  { href: "/admin/config", label: "Config", icon: Settings },
] as const;

type AdminDesktopHeaderProps = {
  logoUrl?: string | null;
  clubName?: string | null;
};

function AdminDesktopHeaderInner({ logoUrl, clubName }: AdminDesktopHeaderProps) {
  const pathname = usePathname();
  if (isFacturacionPath(pathname)) return null;

  return (
    <header
      className="sticky top-0 z-40 hidden md:block"
      style={{ background: "var(--admin-header-bg)", borderBottom: "2px solid var(--admin-header-lima-line)" }}
    >
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-2 md:px-6">
        <div className="min-w-0 shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
            <img
              src={logoUrl}
              alt={clubName ?? "Club"}
              className="h-9 w-9 rounded-xl border object-cover"
              style={{ borderColor: "var(--admin-header-logo-border)" }}
            />
          ) : (
            <div
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-white/10 text-xs font-bold"
              style={{ color: "var(--admin-header-text)", borderColor: "var(--admin-header-logo-border)" }}
            >
              {(clubName ?? "Club").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <nav className="flex flex-nowrap items-center justify-end gap-0.5 overflow-visible" aria-label="Modulos">
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
                className="relative inline-flex items-center gap-0.5 rounded-xl px-1.5 py-1 text-[11px] font-semibold touch-manipulation transition-colors"
                style={{ color: active ? "var(--admin-header-active-text)" : "var(--admin-header-text)" }}
              >
                {active ? (
                  <motion.span
                    layoutId="admin-desktop-nav-pill"
                    className="absolute inset-0 -z-10 rounded-xl"
                    style={{ background: "var(--admin-header-active-bg)" }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <Icon size={14} strokeWidth={2} />
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
