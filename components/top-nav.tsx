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
  { href: "#", label: "Cómo funciona", icon: FileText },
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
        <div className="flex h-14 w-full max-w-md items-center justify-between bg-sky-500 px-4">
          <span className="text-lg font-bold text-white">Padelibre</span>
          <div className="flex items-center gap-3">
            <Link
              href="/notificaciones"
              className="rounded-full p-2 text-white transition-opacity hover:opacity-90"
              aria-label="Ir a notificaciones"
            >
              <div className="relative">
                <Bell size={22} className="text-white" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </div>
            </Link>
            <button
              type="button"
              className="rounded-full p-2 text-white transition-opacity hover:opacity-90"
              onClick={() => setOpen(true)}
              aria-label="Abrir menú lateral"
            >
              <Menu size={20} />
            </button>
          </div>
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
                  className="pointer-events-auto absolute right-0 top-0 z-50 flex h-full w-80 max-w-[85%] flex-col overflow-y-auto bg-white shadow-2xl"
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4">
                    {avatarUrl?.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element -- avatar externo desde Supabase
                      <img
                        src={avatarUrl}
                        alt=""
                        width={44}
                        height={44}
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500 text-sm font-bold text-white">
                        {initial}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                      <p className="truncate text-xs text-slate-500">{category || "Sin categoría"}</p>
                    </div>
                  </div>

                  <p className="px-4 py-2 text-xs uppercase tracking-widest text-slate-400">TU CUENTA</p>
                  {accountItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeDrawer}
                        className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                      >
                        <span className="rounded-full bg-slate-100 p-2">
                          <Icon size={16} />
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}

                  <p className="px-4 py-2 text-xs uppercase tracking-widest text-slate-400">SOPORTE</p>
                  {supportItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={closeDrawer}
                        className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                      >
                        <span className="rounded-full bg-slate-100 p-2">
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
                    className="mt-auto flex items-center gap-3 border-t border-slate-200 px-4 py-3 text-sm font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span className="rounded-full bg-slate-100 p-2 text-slate-700">
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
