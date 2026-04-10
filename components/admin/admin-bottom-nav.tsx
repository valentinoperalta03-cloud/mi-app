"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, House, UserRound } from "lucide-react";

const items = [
  { href: "/admin/dashboard", label: "Inicio", icon: House },
  { href: "/club/gestion", label: "Gestion", icon: CalendarClock },
  { href: "/perfil", label: "Perfil", icon: UserRound },
] as const;

export default function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Navegacion principal del club"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin/dashboard"
              ? pathname === "/admin/dashboard" || pathname === "/admin"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-2xl px-3 py-2 text-[11px] font-semibold transition-all active:scale-95 ${
                active ? "text-sky-600" : "text-slate-500"
              }`}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.25 : 2}
                className={active ? "text-sky-600" : "text-slate-400"}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
