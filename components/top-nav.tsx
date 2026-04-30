"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CircleHelp,
  CreditCard,
  FileText,
  LogOut,
  Menu,
  Settings,
  Shield,
  User,
  UserCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/client";

type DrawerItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

const accountItems: DrawerItem[] = [
  { href: "/perfil/editar", label: "Editar perfil", icon: User },
  { href: "/perfil/actividad", label: "Tu actividad", icon: UserCircle },
  { href: "/perfil/pagos", label: "Tus pagos", icon: CreditCard },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

const supportItems: DrawerItem[] = [
  { href: "/ayuda", label: "Ayuda", icon: CircleHelp },
  { href: "/como-funciona", label: "Cómo funciona", icon: FileText },
  { href: "/legal/terminos", label: "Condiciones de uso", icon: Shield },
  { href: "/legal/privacidad", label: "Política de privacidad", icon: FileText },
];

export default function TopNav() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [name, setName] = useState("Jugador");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void supabase.auth.getUser().then(async ({ data }) => {
      const userId = data.user?.id;
      if (!userId) return;
      const { data: profile } = await supabase
        .from(DB_TABLES.profiles)
        .select("name, avatar_url, category")
        .eq("user_id", userId)
        .maybeSingle();

      if (!active) return;
      const typed = profile as {
        name?: string | null;
        avatar_url?: string | null;
        category?: string | null;
      } | null;
      setName(typed?.name?.trim() || "Jugador");
      setAvatarUrl(typed?.avatar_url ?? null);
      setCategory(typed?.category ?? null);

      const { count } = await supabase
        .from(DB_TABLES.notifications)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);
      if (!active) return;
      setUnreadCount(count ?? 0);
    });

    return () => {
      active = false;
    };
  }, []);

  const initial = useMemo(() => (name.trim()[0] ?? "J").toUpperCase(), [name]);

  function closeDrawer() {
    setOpen(false);
  }

  async function handleSignOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    closeDrawer();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 flex justify-center">
        <div className="w-full max-w-md">
          <div
            className="flex h-14 items-center justify-between px-4"
            style={{
              background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)",
              boxShadow: "0 2px 12px rgba(5,133,252,0.3)",
            }}
          >
            <div className="flex items-center gap-2">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="10" fill="#0585FC" opacity="0.9" />
                <circle cx="11" cy="11" r="10" fill="none" stroke="#38bdf8" strokeWidth="1" />
                <path d="M4 8 Q11 6 18 8" stroke="white" strokeWidth="1.2" fill="none" opacity="0.6" />
                <path d="M4 11 Q11 9 18 11" stroke="white" strokeWidth="1.2" fill="none" opacity="0.6" />
                <path d="M4 14 Q11 12 18 14" stroke="white" strokeWidth="1.2" fill="none" opacity="0.6" />
              </svg>
              <span className="text-lg font-bold tracking-tight text-white" style={{ letterSpacing: "-0.02em" }}>
                Padelibre
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Link
                href="/notificaciones"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-white/10"
                aria-label="Ir a notificaciones"
              >
                <Bell size={20} className="text-white/90" />
                {unreadCount > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Link>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-white/10"
                onClick={() => setOpen(true)}
                aria-label="Abrir menú lateral"
              >
                <Menu size={20} className="text-white/90" />
              </button>
            </div>
          </div>

          <div
            className="h-0.5 w-full"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)" }}
          />
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/40"
              onClick={closeDrawer}
              aria-label="Cerrar menú"
            />

            <div className="pointer-events-none fixed inset-0 z-40 flex justify-center">
              <div className="pointer-events-none relative w-full max-w-md">
                <motion.aside
                  className="pointer-events-auto absolute right-0 top-0 z-50 flex h-full w-80 max-w-[85%] flex-col overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+6.5rem)] shadow-2xl"
                  style={{
                    background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)",
                    boxShadow: "-8px 0 32px rgba(5,133,252,0.25)",
                  }}
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <div className="border-b border-white/10 p-5">
                    <div className="flex items-center gap-3">
                      {avatarUrl?.trim() ? (
                        // eslint-disable-next-line @next/next/no-img-element -- avatar externo desde Supabase
                        <img
                          src={avatarUrl}
                          alt=""
                          width={44}
                          height={44}
                          className="h-11 w-11 rounded-full object-cover ring-2 ring-white/40"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white ring-2 ring-white/40">
                          {initial}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-bold text-white">{name}</p>
                        <div className="mt-1">
                          <Badge variant="brand">{category ? `Nivel ${category}` : "Sin nivel asignado"}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="px-4 py-2 text-xs uppercase tracking-widest text-blue-200/60">TU CUENTA</p>
                  {accountItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeDrawer}
                        className="flex items-center gap-3 border-b border-white/10 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
                      >
                        <span className="rounded-full bg-white/5 p-2 text-white">
                          <Icon size={16} />
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}

                  <p className="px-4 py-2 text-xs uppercase tracking-widest text-blue-200/60">SOPORTE</p>
                  {supportItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={closeDrawer}
                        className="flex items-center gap-3 border-b border-white/10 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
                      >
                        <span className="rounded-full bg-white/5 p-2 text-white">
                          <Icon size={16} />
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    disabled={busy}
                    className="mx-4 mb-0 mt-auto flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span className="rounded-full bg-red-500/10 p-2 text-red-300">
                      <LogOut size={16} />
                    </span>
                    <span>{busy ? "Cerrando sesión…" : "Cerrar sesión"}</span>
                  </button>
                </motion.aside>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
