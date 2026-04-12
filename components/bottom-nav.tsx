"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Home, UserCircle, Users } from "lucide-react";

const items = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/comunidad", label: "Comunidad", icon: Users },
  { href: "/perfil", label: "Perfil", icon: UserCircle },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      aria-label="Navegación principal"
    >
      <div className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-1 rounded-full border border-white/60 bg-white/80 px-2 py-2 shadow-[0_8px_32px_-10px_rgba(15,23,42,0.2)] backdrop-blur-md backdrop-saturate-150">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/home" && pathname.startsWith(`${item.href}/`)) ||
            (item.href === "/home" && pathname === "/inicio");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full py-2.5 text-[11px] font-semibold transition-colors ${
                active ? "text-sky-600" : "text-slate-500 active:text-slate-800"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="player-bottom-nav-glow"
                  className="absolute inset-x-1 inset-y-1 -z-10 rounded-full bg-sky-500/10 ring-1 ring-sky-500/15"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              ) : null}
              <motion.span
                className="flex flex-col items-center gap-1"
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 520, damping: 28 }}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2.35 : 2} aria-hidden />
                  {active ? (
                    <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-sky-600" />
                  ) : null}
                </span>
                <span>{item.label}</span>
              </motion.span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
