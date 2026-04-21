"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/client";

type NotificationRow = {
  id: string;
  type: string | null;
  title: string | null;
  body: string | null;
  match_id: string | null;
  is_read: boolean | null;
  created_at: string | null;
};

function notificationHref(n: NotificationRow): string {
  const t = String(n.type ?? "").toLowerCase();
  if (n.match_id && (t.includes("join") || t.includes("player_joined") || t.includes("result"))) {
    return `/partidos/${n.match_id}`;
  }
  if (t.includes("reservation") || t.includes("payment")) {
    return "/reservas";
  }
  return "/notificaciones";
}

export default function NotificationsCenter() {
  const supabase = createClient();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const unreadCount = useMemo(() => rows.filter((r) => !r.is_read).length, [rows]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUserId(data.user?.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, [supabase.auth]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    async function loadNotifications() {
      const { data } = await supabase
        .from(DB_TABLES.notifications)
        .select("id,type,title,body,match_id,is_read,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!alive) return;
      setRows((data ?? []) as NotificationRow[]);
    }

    void loadNotifications();
    const poll = window.setInterval(() => {
      void loadNotifications();
    }, 30000);

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: DB_TABLES.notifications },
        (payload) => {
          const record = (payload.new ?? payload.old) as { user_id?: string } | null;
          if (!record || record.user_id !== userId) return;
          void loadNotifications();
        }
      )
      .subscribe();

    return () => {
      alive = false;
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  useEffect(() => {
    function onClickOutside(ev: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(ev.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markAllRead() {
    if (!userId || rows.length === 0) return;
    setRows((prev) => prev.map((r) => ({ ...r, is_read: true })));
    await supabase
      .from(DB_TABLES.notifications)
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
  }

  if (!userId) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-12 w-12 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
        aria-label="Abrir notificaciones"
      >
        <Bell size={20} />
        {unreadCount > 0 ? (
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-[rgba(10,22,40,0.95)]" />
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.section
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-14 right-0 z-[70] w-[min(92vw,22rem)] overflow-hidden rounded-3xl border border-white/10 bg-[rgba(10,22,40,0.88)] text-white shadow-[0_16px_40px_-16px_rgba(2,6,23,0.65)] backdrop-blur-xl"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="relative h-5 w-16 overflow-hidden opacity-70">
                  <Image src="/logo-marca.png" alt="Padelibre" fill className="object-contain" />
                </div>
                <p className="text-sm font-semibold">Notificaciones</p>
              </div>
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-semibold text-sky-300 transition hover:text-sky-200"
              >
                Marcar todas
              </button>
            </header>

            <ul className="max-h-80 overflow-y-auto p-2">
              {rows.map((n) => (
                <li key={n.id}>
                  <Link
                    href={notificationHref(n)}
                    onClick={() => setOpen(false)}
                    className={`block rounded-2xl px-3 py-2.5 transition ${
                      n.is_read ? "hover:bg-white/5" : "bg-sky-500/10 hover:bg-sky-500/15"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read ? <span className="mt-1.5 h-2 w-2 rounded-full bg-sky-300" /> : null}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{n.title ?? "Notificación"}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-white/75">
                          {n.body ?? "Tenés una novedad en Padelibre."}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
              {rows.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-white/70">No tenés notificaciones nuevas.</li>
              ) : null}
            </ul>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
