"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { CalendarDays, House, Trophy, UserRound } from "lucide-react";

const items = [
  { href: "/inicio", label: "Inicio", icon: House },
  { href: "/partidos", label: "Partidos", icon: Trophy },
  { href: "/reservas", label: "Reservas", icon: CalendarDays },
  { href: "/perfil", label: "Perfil", icon: UserRound },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 justify-between border-t border-gray-100 bg-white/80 px-4 pt-2 shadow-[0_2px_10px_rgba(0,0,0,0.05)] backdrop-blur-md"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);

        return (
          <motion.div
            key={item.href}
            animate={isActive ? { y: -3, scale: 1.05 } : { y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
          >
            <Link
              href={item.href}
              className="ui-interactive flex min-w-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1 text-xs font-medium"
              style={{
                color: isActive ? "hsl(var(--color-primary))" : "hsl(var(--color-muted))",
              }}
            >
              <Icon size={18} strokeWidth={2} />
              <span>{item.label}</span>
            </Link>
          </motion.div>
        );
      })}
    </nav>
  );
}
