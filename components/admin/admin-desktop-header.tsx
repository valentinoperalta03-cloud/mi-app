"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, DollarSign, House, LogOut, Settings, Target, Users } from "lucide-react";
import { memo } from "react";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggleButton from "@/components/theme-toggle-button";
import { createClient } from "@/utils/supabase/client";

const desktopLinks = [
  { href: "/admin/dashboard", label: "Inicio", icon: House },
  { href: "/admin/reservas", label: "Partidos", icon: Target },
  { href: "/admin/finanzas", label: "Finanzas", icon: DollarSign },
  { href: "/admin/analytics", label: "Ocupación", icon: Activity },
  { href: "/admin/pagos", label: "Pagos", icon: DollarSign },
  { href: "/admin/jugadores", label: "Jugadores", icon: Users },
  { href: "/admin/club", label: "Club", icon: House },
  { href: "/admin/config", label: "Config", icon: Settings },
] as const;

function AdminDesktopHeaderInner() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 hidden border-b border-slate-100/80 bg-white/85 backdrop-blur-md md:block dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">Panel del club</p>
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
                  active ? "text-[#0461C4] dark:text-sky-400" : "text-slate-600 hover:bg-slate-50 hover:text-[#0585FC] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-400"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="admin-desktop-nav-pill"
                    className="absolute inset-0 -z-10 rounded-2xl bg-[#0585FC]/10/85 ring-1 ring-[#0585FC]/20/50"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <Icon size={16} strokeWidth={2} className={active ? "text-[#0585FC] dark:text-sky-400" : "text-slate-400 dark:text-slate-500"} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <div className="w-56">
            <ThemeToggleButton />
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}

export default memo(AdminDesktopHeaderInner);
