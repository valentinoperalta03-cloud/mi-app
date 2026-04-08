"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, Trophy, UserRound } from "lucide-react";

const items = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/partidos", label: "Partidos", icon: Trophy },
  { href: "/reservas", label: "Reservas", icon: CalendarDays },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 justify-between border-t border-gray-100 bg-white px-4 pt-2 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className="ui-interactive flex min-w-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1 text-xs font-medium"
            style={{
              color: isActive ? "hsl(var(--color-primary))" : "hsl(var(--color-muted))",
            }}
          >
            <Icon size={18} strokeWidth={2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
