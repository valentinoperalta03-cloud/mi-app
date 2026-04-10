"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, DollarSign, Settings, Target, Users } from "lucide-react";

const items = [
  { href: "/admin/reservas", label: "Reservas", icon: Target },
  { href: "/admin/finanzas", label: "Finanzas", icon: DollarSign },
  { href: "/admin/analytics", label: "Ocupacion", icon: Activity },
  { href: "/admin/jugadores", label: "Jugadores", icon: Users },
  { href: "/admin/config", label: "Config", icon: Settings },
] as const;

export default function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Modulos del panel"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0 px-1 pt-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[10px] font-semibold leading-tight transition-all active:scale-95 sm:text-[11px] ${
                active ? "text-sky-600" : "text-slate-500"
              }`}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.25 : 2}
                className={active ? "text-sky-600" : "text-slate-400"}
                aria-hidden
              />
              <span className="line-clamp-2 text-center">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
