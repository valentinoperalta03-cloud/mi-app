"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];
// Deben coincidir con --admin-sidebar-width / --admin-sidebar-collapsed-width
// en globals.css — Framer no puede interpolar numéricamente una var() CSS.
const WIDTH_EXPANDED = 340;
const WIDTH_COLLAPSED = 88;

/** Botón/ícono de 48x48 en modo colapsado — misma estética para Hoy, grupos, expandir y avatar. */
function CollapsedButton({
  href,
  active,
  onClick,
  onMouseEnter,
  onMouseLeave,
  ariaLabel,
  children,
}: {
  href?: string;
  active?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const className = `flex h-12 w-12 cursor-pointer items-center justify-center rounded-[10px] border transition-colors duration-150 ease-out ${
    active
      ? "border-[rgba(0,133,252,0.25)] bg-[rgba(0,133,252,0.15)]"
      : "border-transparent hover:bg-[var(--admin-sidebar-hover-bg)]"
  }`;
  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={className} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </button>
  );
}

/** Sub-item dentro de un grupo expandido, o dentro de un flyout en modo colapsado. */
function SubItem({ item, active }: { item: AdminNavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-lg py-[7px] pl-11 pr-3 text-[13px] transition-colors duration-150 ease-out ${
        active
          ? "bg-[rgba(0,133,252,0.12)] text-[#0085FC]"
          : "text-[var(--admin-sidebar-text-soft)] hover:bg-[var(--admin-sidebar-hover-bg)] hover:text-[var(--text-primary)]"
      }`}
    >
      <Icon size={22} className={`shrink-0 ${active ? "text-[#0085FC] dark:text-[#CCFF00]" : "text-[var(--text-tertiary)]"}`} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function GroupBlock({
  group,
  open,
  active,
  onToggle,
  pathname,
}: {
  group: AdminNavGroup;
  open: boolean;
  active: boolean;
  onToggle: () => void;
  pathname: string;
}) {
  const Icon = group.icon;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`group flex w-full cursor-pointer items-center gap-2.5 border-l-[3px] px-4 pb-1.5 pt-4 text-left transition-colors duration-150 ease-out ${
          active ? "border-[#0085FC] bg-[rgba(0,133,252,0.10)]" : "border-transparent hover:bg-[var(--admin-sidebar-hover-bg)]"
        }`}
      >
        <Icon size={18} className={`shrink-0 ${active ? "text-[#0085FC]" : "text-[var(--admin-sidebar-group-label)]"}`} />
        <span
          className={`font-admin-mono flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors duration-150 ease-out ${
            active ? "text-[#0085FC]" : "text-[var(--admin-sidebar-group-label)] group-hover:text-[var(--admin-sidebar-text-strong)]"
          }`}
        >
          {group.title}
        </span>
        {open ? (
          <ChevronDown size={14} className="ml-auto shrink-0 text-[var(--admin-sidebar-group-label)]" />
        ) : (
          <ChevronRight size={14} className="ml-auto shrink-0 text-[var(--admin-sidebar-group-label)]" />
        )}
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
            <div className="flex flex-col gap-0.5 py-1">
              {group.items.map((item) => (
                <SubItem key={item.href} item={item} active={isAdminNavItemActive(pathname, item.href)} />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Panel flotante con los items de un grupo, al hover de su ícono en modo colapsado. */
function GroupFlyout({
  group,
  pathname,
  onMouseEnter,
  onMouseLeave,
}: {
  group: AdminNavGroup;
  pathname: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-50 w-60 rounded-xl border border-black/10 bg-white p-2 shadow-[0_8px_32px_rgba(0,0,0,0.30)] dark:border-white/10 dark:bg-[#0C1829]"
      style={{ left: "calc(var(--admin-sidebar-collapsed-width) + 8px)" }}
    >
      <p className="font-admin-mono px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-sidebar-group-label)]">
        {group.title}
      </p>
      <div className="flex flex-col gap-0.5">
        {group.items.map((item) => (
          <SubItem key={item.href} item={item} active={isAdminNavItemActive(pathname, item.href)} />
        ))}
      </div>
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
  const [flyoutGroup, setFlyoutGroup] = useState<string | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // El grupo que contiene la ruta activa se abre solo, aunque esté cerrado por default.
  useEffect(() => {
    const activeKey = findActiveGroupKey(pathname);
    if (!activeKey) return;
    setOpenGroups((prev) => (prev[activeKey] ? prev : { ...prev, [activeKey]: true }));
  }, [pathname]);

  useEffect(() => () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  }, []);

  function openFlyout(key: string) {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setFlyoutGroup(key);
  }

  function scheduleCloseFlyout() {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => setFlyoutGroup(null), 150);
  }

  if (isFacturacionPath(pathname)) return null;

  const displayName = (ownerName?.trim() || "Dueño").trim();
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "D";
  const homeActive = isAdminNavItemActive(pathname, ADMIN_NAV_HOME.href);
  const HomeIcon = ADMIN_NAV_HOME.icon;

  const logoElement = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
    <img
      src={logoUrl}
      alt={clubName ?? "Club"}
      className="h-11 w-11 shrink-0 rounded-xl border-2 object-cover"
      style={{ borderColor: "var(--admin-sidebar-logo-border)" }}
    />
  ) : (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 bg-[#0085FC] text-sm font-bold text-white"
      style={{ borderColor: "var(--admin-sidebar-logo-border)" }}
    >
      {(clubName ?? "Club").slice(0, 1).toUpperCase()}
    </div>
  );

  return (
    <motion.aside
      className="admin-sidebar fixed bottom-0 left-0 top-0 z-40 hidden flex-col overflow-hidden md:flex"
      initial={false}
      animate={{ width: collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED }}
      transition={{ duration: 0.25, ease: EASE }}
      style={{ borderTop: "2px solid var(--admin-accent-lima)" }}
    >
      {/* Header */}
      {collapsed ? (
        <div className="relative flex shrink-0 flex-col items-center gap-2 border-b border-[var(--admin-sidebar-border-subtle)] px-2 py-4">
          <Link href="/admin/dashboard">{logoElement}</Link>
          <CollapsedButton onClick={() => setCollapsed(false)} ariaLabel="Expandir menú">
            <ChevronRight size={28} className="text-[#0085FC] dark:text-[#CCFF00]" />
          </CollapsedButton>
        </div>
      ) : (
        <div className="relative flex h-[72px] shrink-0 items-center border-b border-[var(--admin-sidebar-border-subtle)] px-5">
          <Link href="/admin/dashboard" className="flex min-w-0 items-center pr-10">
            {logoElement}
            <div className="ml-3 min-w-0">
              <p className="font-admin-display truncate text-[15px] font-bold text-[var(--text-primary)]">
                {clubName ?? "Mi club"}
              </p>
              <p className="truncate text-[11px] text-[var(--admin-sidebar-text-muted)]">Panel de administración</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Colapsar menú"
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg bg-[rgba(0,133,252,0.08)] text-[var(--text-tertiary)] transition-colors duration-150 ease-out hover:bg-[var(--admin-sidebar-hover-bg-strong)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {collapsed ? (
          <div className="flex flex-col gap-1.5 pt-3">
            <div className="flex justify-center">
              <CollapsedButton href={ADMIN_NAV_HOME.href} active={homeActive} ariaLabel={ADMIN_NAV_HOME.label}>
                <HomeIcon size={28} className="text-[#0085FC] dark:text-[#CCFF00]" />
              </CollapsedButton>
            </div>

            {ADMIN_NAV_GROUPS.map((group) => {
              const groupActive = findActiveGroupKey(pathname) === group.key;
              const GroupIcon = group.icon;
              return (
                <div key={group.key} className="relative flex justify-center">
                  <CollapsedButton
                    active={groupActive}
                    ariaLabel={group.title}
                    onMouseEnter={() => openFlyout(group.key)}
                    onMouseLeave={scheduleCloseFlyout}
                  >
                    <GroupIcon size={28} className="text-[#0085FC] dark:text-[#CCFF00]" />
                  </CollapsedButton>
                  {flyoutGroup === group.key ? (
                    <GroupFlyout
                      group={group}
                      pathname={pathname}
                      onMouseEnter={() => openFlyout(group.key)}
                      onMouseLeave={scheduleCloseFlyout}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="pb-1 pt-2">
              <Link
                href={ADMIN_NAV_HOME.href}
                className={`flex items-center gap-2.5 border-l-[3px] px-4 py-2.5 text-sm font-medium transition-colors duration-150 ease-out ${
                  homeActive
                    ? "border-[#0085FC] bg-[rgba(0,133,252,0.15)] text-[#0085FC]"
                    : "border-transparent text-[var(--admin-sidebar-text-strong)] hover:bg-[var(--admin-sidebar-hover-bg)] hover:text-[var(--text-primary)]"
                }`}
              >
                <HomeIcon size={18} className={homeActive ? "text-[#0085FC] dark:text-[#CCFF00]" : "text-[var(--text-tertiary)]"} />
                <span className="truncate">{ADMIN_NAV_HOME.label}</span>
              </Link>
            </div>

            {ADMIN_NAV_GROUPS.map((group, idx) => (
              <div key={group.key}>
                {idx > 0 ? <div className="mx-4 border-t border-[var(--admin-sidebar-border-subtle)]" /> : null}
                <GroupBlock
                  group={group}
                  open={Boolean(openGroups[group.key])}
                  active={findActiveGroupKey(pathname) === group.key}
                  onToggle={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                  pathname={pathname}
                />
              </div>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div
        className={`relative shrink-0 py-4 ${collapsed ? "px-2" : "px-5"}`}
        style={{ borderTop: "1px solid var(--admin-sidebar-border-subtle)" }}
      >
        {collapsed ? (
          <CollapsedButton onClick={() => setMenuOpen((v) => !v)} ariaLabel="Más opciones">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0085FC] text-[13px] font-bold text-white">
              {initials}
            </div>
          </CollapsedButton>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0085FC] text-[13px] font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{displayName}</p>
              <p className="truncate text-[11px] text-[var(--admin-sidebar-text-muted)]">{ownerEmail ?? ""}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              aria-label="Más opciones"
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors duration-150 ease-out hover:bg-[var(--admin-sidebar-hover-bg-strong)] hover:text-[var(--text-primary)]"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        )}

        {menuOpen ? (
          <>
            <button
              type="button"
              aria-label="Cerrar menú"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setMenuOpen(false)}
            />
            <div
              className={`absolute bottom-full z-50 mb-2 min-w-[10rem] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2 shadow-lg ${
                collapsed ? "left-1/2 -translate-x-1/2" : "left-3"
              }`}
            >
              <div onClick={() => setMenuOpen(false)}>
                <AdminSignOutLink />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </motion.aside>
  );
}
