"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Home, UserCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/client";

const items = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/comunidad", label: "Comunidad", icon: Users },
  { href: "/perfil", label: "Perfil", icon: UserCircle },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>("Perfil");

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      const userId = data.user?.id;
      if (!userId) return;
      const { data: profile } = await supabase
        .from(DB_TABLES.profiles)
        .select("name, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active) return;
      const typed = profile as { name?: string | null; avatar_url?: string | null } | null;
      setMyAvatarUrl(typed?.avatar_url ?? null);
      setMyName(typed?.name?.trim() || "Perfil");
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      aria-label="Navegación principal"
    >
      <div
        className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-1 rounded-2xl border border-blue-500/20 bg-[rgba(10,22,40,0.92)] px-2 py-2 shadow-[0_-4px_32px_rgba(10,22,40,0.3),0_8px_32px_rgba(10,22,40,0.2)] backdrop-blur-[20px] dark:border-slate-700/40 dark:bg-[rgba(2,6,23,0.92)]"
      >
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
                active ? "text-sky-400" : "text-white/40"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="player-bottom-nav-glow"
                  className="absolute inset-x-1 inset-y-1 -z-10 rounded-full bg-sky-500/20"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              ) : null}
              <motion.span
                className="flex flex-col items-center gap-1"
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 520, damping: 28 }}
              >
                <span className="relative">
                  {item.href === "/perfil" ? (
                    <ProfileAvatar
                      avatarUrl={myAvatarUrl}
                      name={myName}
                      size={24}
                      ringClassName={active ? "ring-1 ring-sky-400" : "ring-1 ring-slate-300"}
                    />
                  ) : (
                    <Icon size={22} strokeWidth={active ? 2.35 : 2} aria-hidden />
                  )}
                  {active ? (
                    <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-sky-400" />
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
