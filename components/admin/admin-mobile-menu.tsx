"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { adminSectionLabel } from "@/components/admin/admin-premium";
import { ADMIN_NAV_GROUPS, ADMIN_NAV_HOME, isAdminNavItemActive } from "@/lib/admin/nav-groups";

export default function AdminMobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Cierra el drawer solo cuando el usuario efectivamente navega a otra ruta,
  // no en el mount inicial (evita que se auto-cierre apenas se abre).
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reaccionar a cambios de ruta
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!portalReady || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-x-0 bottom-0 z-[75] bg-black/50 md:hidden"
            style={{ top: "var(--admin-top-chrome-offset)" }}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Menú del panel"
            className="fixed inset-x-0 bottom-0 z-[76] flex flex-col overflow-hidden border-t border-[var(--border-subtle)] bg-[var(--bg-card)] dark:bg-[linear-gradient(180deg,#0C1829_0%,#051c40_100%)] dark:border-white/10 md:hidden"
            style={{ top: "var(--admin-top-chrome-offset)" }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-5 py-4 dark:border-white/10 dark:bg-transparent">
              <p className="text-base font-bold text-[var(--text-primary)]">Menú</p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar menú"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] transition hover:bg-[var(--border-subtle)]"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
              <div className="pt-3">
                {(() => {
                  const Icon = ADMIN_NAV_HOME.icon;
                  const active = isAdminNavItemActive(pathname, ADMIN_NAV_HOME.href);
                  return (
                    <Link
                      href={ADMIN_NAV_HOME.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                        active
                          ? "border-l-2 border-[var(--admin-accent-lima)] bg-[rgba(0,133,252,0.08)] text-[var(--text-primary)] dark:bg-[rgba(204,255,0,0.08)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-app)] dark:hover:bg-white/[0.07]"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          active
                            ? "bg-[rgba(0,133,252,0.08)] text-[var(--text-primary)] dark:bg-[rgba(204,255,0,0.08)]"
                            : "bg-[var(--bg-subtle)] text-[var(--text-tertiary)]"
                        }`}
                      >
                        <Icon size={18} aria-hidden />
                      </span>
                      {ADMIN_NAV_HOME.label}
                    </Link>
                  );
                })()}
              </div>
              {ADMIN_NAV_GROUPS.map((group) => (
                <div
                  key={group.key}
                  className="mt-2 border-t border-[rgba(0,133,252,0.15)] pt-3 dark:border-[rgba(204,255,0,0.12)]"
                >
                  <p className={`px-3 pb-1.5 ${adminSectionLabel}`}>
                    {group.title}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isAdminNavItemActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                            active
                              ? "border-l-2 border-[var(--admin-accent-lima)] bg-[rgba(0,133,252,0.08)] text-[var(--text-primary)] dark:bg-[rgba(204,255,0,0.08)]"
                              : "text-[var(--text-secondary)] hover:bg-[var(--bg-app)] dark:hover:bg-white/[0.07]"
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              active
                                ? "bg-[rgba(0,133,252,0.08)] text-[var(--text-primary)] dark:bg-[rgba(204,255,0,0.08)]"
                                : "bg-[var(--bg-subtle)] text-[var(--text-tertiary)]"
                            }`}
                          >
                            <Icon size={18} aria-hidden />
                          </span>
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="shrink-0"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
