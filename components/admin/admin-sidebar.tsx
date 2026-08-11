"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { isFacturacionPath } from "@/lib/auth-redirect";
import {
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_HOME,
  findActiveGroupKey,
  isAdminNavItemActive,
  type AdminNavGroup,
  type AdminNavItem,
} from "@/lib/admin/nav-groups";
import { AdminSignOutLink } from "./admin-sign-out-link";
import { useAdminSidebar } from "./admin-sidebar-context";

function NavLink({
  item,
  collapsed,
  active,
}: {
  item: AdminNavItem;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ${
        active
          ? "text-[#0085FC]"
          : "text-[var(--text-secondary)] hover:bg-[rgba(0,133,252,0.06)] hover:text-[var(--text-primary)]"
      } ${collapsed ? "justify-center px-0" : ""}`}
    >
      {active ? (
        <motion.span
          layoutId="admin-sidebar-active-pill"
          className="absolute inset-0 -z-10 rounded-lg"
          style={{ background: "rgba(0,133,252,0.12)" }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      ) : null}
      <Icon size={16} className="shrink-0 text-[#0085FC] dark:text-[#CCFF00]" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
      {collapsed ? (
        <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-lg bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] opacity-0 shadow-lg ring-1 ring-[var(--border-subtle)] transition-opacity duration-150 group-hover:opacity-100">
          {item.label}
        </span>
      ) : null}
    </Link>
  );
}

function GroupBlock({
  group,
  open,
  active,
  onToggle,
}: {
  group: AdminNavGroup;
  open: boolean;
  active: boolean;
  onToggle: () => void;
}) {
  const Icon = group.icon;
  const pathname = usePathname();
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors duration-200 hover:bg-[rgba(0,133,252,0.06)]"
      >
        <Icon size={16} className="shrink-0" style={{ color: active ? "#0085FC" : "var(--text-tertiary)" }} />
        <span
          className="font-admin-mono flex-1 truncate text-[11px] font-semibold uppercase"
          style={{ letterSpacing: "0.10em", color: active ? "#0085FC" : "var(--text-tertiary)" }}
        >
          {group.title}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-[var(--text-tertiary)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 py-1 pl-1">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} collapsed={false} active={isAdminNavItemActive(pathname, item.href)} />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function AdminSidebar({
  clubName,
  logoUrl,
  ownerName,
  ownerEmail,
}: {
  clubName: string | null;
  logoUrl: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
}) {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useAdminSidebar();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ADMIN_NAV_GROUPS.map((g) => [g.key, g.defaultOpen]))
  );
  const [menuOpen, setMenuOpen] = useState(false);

  // El grupo que contiene la ruta activa se abre solo, aunque esté cerrado por default.
  useEffect(() => {
    const activeKey = findActiveGroupKey(pathname);
    if (!activeKey) return;
    setOpenGroups((prev) => (prev[activeKey] ? prev : { ...prev, [activeKey]: true }));
  }, [pathname]);

  if (isFacturacionPath(pathname)) return null;

  const displayName = (ownerName?.trim() || "Dueño").trim();
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "D";

  return (
    <aside
      className="admin-sidebar fixed bottom-0 left-0 top-0 z-40 hidden flex-col md:flex"
      style={{
        width: collapsed ? "var(--admin-sidebar-collapsed-width)" : "var(--admin-sidebar-width)",
        transition: "width 300ms ease",
        borderTop: "2px solid var(--admin-accent-lima)",
      }}
    >
      {/* Header */}
      <div className={`flex shrink-0 items-center gap-2.5 border-b border-[var(--border-subtle)] p-3 ${collapsed ? "flex-col" : ""}`}>
        <Link href="/admin/dashboard" className="flex min-w-0 flex-1 items-center gap-2.5" style={collapsed ? { flex: "none" } : undefined}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
            <img src={logoUrl} alt={clubName ?? "Club"} className="h-9 w-9 shrink-0 rounded-full border border-[var(--border-subtle)] object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0085FC] text-xs font-bold text-white">
              {(clubName ?? "Club").slice(0, 1).toUpperCase()}
            </div>
          )}
          {!collapsed ? (
            <span className="font-admin-display truncate text-sm font-bold text-[var(--text-primary)]">
              {clubName ?? "Mi club"}
            </span>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[rgba(0,133,252,0.08)] hover:text-[var(--text-primary)]"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
        <div className="flex flex-col gap-0.5">
          <NavLink item={ADMIN_NAV_HOME} collapsed={collapsed} active={isAdminNavItemActive(pathname, ADMIN_NAV_HOME.href)} />
        </div>

        {collapsed ? (
          <div className="mt-1 flex flex-col gap-0.5">
            {ADMIN_NAV_GROUPS.flatMap((group) => group.items).map((item) => (
              <NavLink key={item.href} item={item} collapsed active={isAdminNavItemActive(pathname, item.href)} />
            ))}
          </div>
        ) : (
          ADMIN_NAV_GROUPS.map((group, idx) => (
            <div
              key={group.key}
              className={`mt-1 pt-1 ${idx > 0 ? "border-t border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)]" : ""}`}
            >
              <GroupBlock
                group={group}
                open={Boolean(openGroups[group.key])}
                active={findActiveGroupKey(pathname) === group.key}
                onToggle={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
              />
            </div>
          ))
        )}
      </nav>

      {/* Footer */}
      <div className="relative shrink-0 border-t border-[var(--border-subtle)] p-3">
        <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0085FC] text-xs font-bold text-white">
            {initials}
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{displayName}</p>
              <p className="truncate text-xs text-[var(--text-tertiary)]">{ownerEmail ?? ""}</p>
            </div>
          ) : null}
          {!collapsed ? (
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Más opciones"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[rgba(0,133,252,0.08)] hover:text-[var(--text-primary)]"
            >
              <MoreHorizontal size={16} />
            </button>
          ) : null}
        </div>

        {menuOpen ? (
          <>
            <button
              type="button"
              aria-label="Cerrar menú"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute bottom-full left-3 z-50 mb-2 min-w-[10rem] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2 shadow-lg">
              <div onClick={() => setMenuOpen(false)}>
                <AdminSignOutLink />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}
