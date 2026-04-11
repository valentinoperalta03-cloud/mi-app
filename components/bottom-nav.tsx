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
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center px-3"
      style={{ paddingBottom: "max(0.65rem, env(safe-area-inset-bottom))" }}
      aria-label="Navegación principal"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-stretch justify-between gap-0.5 rounded-[2rem] border border-white/40 bg-white/70 px-2 py-2 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.15),0_2px_8px_-4px_rgba(15,23,42,0.08)] backdrop-blur-xl backdrop-saturate-150">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href === "/inicio" && pathname === "/feed") ||
            pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[1.25rem] py-2 text-[10px] font-semibold transition-colors ${
                active ? "text-sky-600" : "text-slate-500 active:text-slate-800"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="player-bottom-nav-pill"
                  className="absolute inset-x-0.5 inset-y-0.5 -z-10 rounded-[1.15rem] bg-sky-100/90 ring-1 ring-sky-200/50"
                  transition={{ type: "spring", stiffness: 440, damping: 32 }}
                />
              ) : null}
              <motion.span
                className="flex flex-col items-center gap-0.5"
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", stiffness: 520, damping: 28 }}
              >
                <Icon size={20} strokeWidth={active ? 2.35 : 2} aria-hidden />
                <span>{item.label}</span>
              </motion.span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
