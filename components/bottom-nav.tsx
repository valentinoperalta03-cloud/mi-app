"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { Home, UserCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { DB_TABLES } from "@/lib/db-tables";
import { lightTap } from "@/lib/haptics";
import { createClient } from "@/utils/supabase/client";

const items = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/comunidad", label: "Comunidad", icon: Users },
  { href: "/perfil", label: "Perfil", icon: UserCircle },
] as const;

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>("Perfil");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      try {
        const { data } = await supabase.auth.getUser();
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
      } catch (err) {
        console.error("[BottomNav] profile load failed", err);
        if (!active) return;
        setMyAvatarUrl(null);
        setMyName("Perfil");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onDrawerToggle = (event: Event) => {
      const custom = event as CustomEvent<{ open?: boolean }>;
      setDrawerOpen(Boolean(custom.detail?.open));
    };
    setDrawerOpen(document.body.classList.contains("player-drawer-open"));
    window.addEventListener("player-drawer-toggle", onDrawerToggle as EventListener);
    return () => window.removeEventListener("player-drawer-toggle", onDrawerToggle as EventListener);
  }, []);

  return (
    <nav
      className={`player-bottom-nav pointer-events-none fixed left-0 right-0 z-50 flex justify-center bg-transparent px-4 transition-all duration-200 ${
        drawerOpen ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
      }`}
      aria-label="Navegación principal"
    >
      <div
        className="pointer-events-auto flex w-full max-w-md items-center justify-around gap-2 rounded-2xl px-3 py-2"
        style={{
          background: "linear-gradient(135deg, #0085FC 0%, #0461C4 100%)",
          boxShadow: "0 -4px 20px rgba(5,133,252,0.3)",
          border: "none",
        }}
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
              prefetch
              aria-label={`Ir a ${item.label}`}
              aria-current={active ? "page" : undefined}
              onPointerEnter={() => {
                try {
                  router.prefetch(item.href);
                } catch {
                  // ignore
                }
              }}
              onClick={() => {
                if (!active) void lightTap();
              }}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full py-2.5 text-[11px] font-semibold transition-colors ${
                active ? "text-white" : "text-white/55"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="player-bottom-nav-indicator"
                  className="absolute inset-x-1 inset-y-1 -z-10 rounded-full bg-white/15"
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
                      ringClassName={active ? "ring-1 ring-white/70" : "ring-1 ring-white/40"}
                    />
                  ) : (
                    <Icon size={22} strokeWidth={active ? 2.35 : 2} aria-hidden />
                  )}
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
