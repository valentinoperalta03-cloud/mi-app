"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, DollarSign, House, Settings, Target, Users } from "lucide-react";
import { memo } from "react";
import { usePathname } from "next/navigation";

const desktopLinks = [
  { href: "/admin/dashboard", label: "Inicio", icon: House },
  { href: "/admin/reservas", label: "Partidos", icon: Target },
  { href: "/admin/finanzas", label: "Finanzas", icon: DollarSign },
  { href: "/admin/analytics", label: "Ocupación", icon: Activity },
  { href: "/admin/jugadores", label: "Jugadores", icon: Users },
  { href: "/admin/config", label: "Config", icon: Settings },
] as const;

function AdminDesktopHeaderInner() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 hidden border-b border-slate-100/80 bg-white/85 backdrop-blur-md md:block">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-semibold tracking-tight text-slate-900">Panel del club</p>
        <nav className="flex flex-wrap items-center gap-1" aria-label="Modulos">
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
                className={`relative inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-semibold touch-manipulation transition-transform duration-150 hover:scale-[1.02] active:scale-[0.96] ${
                  active ? "text-sky-700" : "text-slate-600 hover:bg-slate-50 hover:text-sky-600"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="admin-desktop-nav-pill"
                    className="absolute inset-0 -z-10 rounded-2xl bg-sky-100/85 ring-1 ring-sky-200/50"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <Icon size={16} strokeWidth={2} className={active ? "text-sky-600" : "text-slate-400"} />
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
