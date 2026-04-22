"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, DollarSign, Settings, Target, Users } from "lucide-react";
import { memo } from "react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin/reservas", label: "Partidos", icon: Target },
  { href: "/admin/finanzas", label: "Finanzas", icon: DollarSign },
  { href: "/admin/analytics", label: "Ocupación", icon: Activity },
  { href: "/admin/jugadores", label: "Jugadores", icon: Users },
  { href: "/admin/config", label: "Ajustes", icon: Settings },
] as const;

function AdminBottomNavInner() {
  const pathname = usePathname();

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      aria-label="Modulos del panel"
    >
      <div className="pointer-events-auto mx-auto max-w-lg px-3">
        <div className="flex items-stretch justify-between gap-0.5 rounded-[1.35rem] border border-slate-200/70 bg-white/85 px-1 py-1.5 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12),0_1px_3px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`relative flex min-w-0 flex-1 touch-manipulation select-none flex-col items-center gap-0.5 rounded-2xl px-0.5 py-1.5 text-[10px] font-semibold leading-tight sm:text-[11px] ${
                  active ? "text-[#0461C4] dark:text-sky-400" : "text-slate-500 active:text-slate-800 dark:text-slate-400 dark:active:text-slate-200"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="admin-bottom-nav-pill"
                    className="absolute inset-x-0.5 inset-y-0.5 -z-10 rounded-2xl bg-[#0585FC]/10/95 ring-1 ring-[#0585FC]/20/50"
                    transition={{ type: "spring", stiffness: 440, damping: 32 }}
                  />
                ) : null}
                <motion.span
                  className="flex flex-col items-center gap-0.5"
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 520, damping: 28 }}
                >
                  <Icon
                    size={21}
                    strokeWidth={active ? 2.35 : 2}
                    className={active ? "text-[#0585FC] dark:text-sky-400" : "text-slate-400 dark:text-slate-500"}
                    aria-hidden
                  />
                  <span className="line-clamp-2 text-center">{item.label}</span>
                </motion.span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default memo(AdminBottomNavInner);
