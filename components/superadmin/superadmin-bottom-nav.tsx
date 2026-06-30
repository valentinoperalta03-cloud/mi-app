"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Building2, DollarSign, House, Users } from "lucide-react";

const items = [
  { href: "/superadmin", label: "Inicio", icon: House },
  { href: "/superadmin/clubes", label: "Clubes", icon: Building2 },
  { href: "/superadmin/finanzas", label: "Finanzas", icon: DollarSign },
  { href: "/superadmin/usuarios", label: "Usuarios", icon: Users },
  { href: "/superadmin/estadisticas", label: "Stats", icon: BarChart2 },
] as const;

export default function SuperadminBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      aria-label="Módulos superadmin"
    >
      <div className="pointer-events-auto mx-auto max-w-lg px-3">
        <div className="flex items-stretch justify-between gap-0.5 rounded-[1.35rem] border border-white/10 bg-slate-900/90 px-1 py-1.5 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/superadmin"
                ? pathname === "/superadmin"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-w-0 flex-1 touch-manipulation select-none flex-col items-center gap-0.5 rounded-2xl px-0.5 py-1.5 text-[10px] font-semibold leading-tight transition ${
                  active ? "text-cyan-300" : "text-slate-400 active:text-slate-200"
                }`}
              >
                {active && (
                  <span className="absolute inset-x-0.5 inset-y-0.5 -z-10 rounded-2xl bg-cyan-500/15 ring-1 ring-cyan-500/30" />
                )}
                <Icon
                  size={21}
                  strokeWidth={active ? 2.35 : 2}
                  className={active ? "text-cyan-300" : "text-slate-500"}
                  aria-hidden
                />
                <span className="line-clamp-1 text-center">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
