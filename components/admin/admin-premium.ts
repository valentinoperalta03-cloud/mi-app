export const adminCard =
  "rounded-2xl border bg-[var(--bg-card)] p-5 " +
  "border-[var(--admin-card-border)] shadow-[var(--admin-card-shadow)] " +
  "transition-all duration-200 hover:border-[var(--admin-card-border-hover)] hover:shadow-[var(--admin-card-shadow-hover)]";

export const adminKicker =
  "font-admin-mono text-[11px] font-semibold uppercase tracking-[0.14em] " +
  "text-[var(--text-tertiary)]";

export const adminTitle =
  "font-admin-display text-2xl font-bold tracking-tight text-[var(--text-primary)] md:text-3xl";

export const adminSubtitle =
  "text-sm font-medium text-[var(--text-secondary)]";

export const adminPressable =
  "touch-manipulation transition-all duration-200 " +
  "active:scale-[0.98] hover:-translate-y-0.5";

export const adminPressableSubtle =
  "touch-manipulation transition-transform duration-150 active:scale-[0.97]";

export const adminCTAPrimary =
  "bg-brand-gradient text-white font-semibold rounded-xl px-4 py-2.5 " +
  "shadow-[0_2px_8px_rgba(5,133,252,0.3)] transition-all duration-200 " +
  "hover:brightness-105 hover:shadow-[0_4px_16px_rgba(5,133,252,0.4)] active:scale-[0.98]";

/** Badge de estado positivo/activo/pagado */
export const adminBadgeLima =
  "inline-flex items-center bg-[var(--admin-accent-lima-subtle)] border border-[var(--admin-accent-lima-border)] " +
  "text-[var(--admin-status-active-text)] text-xs font-semibold rounded-full px-2.5 py-0.5";

/** Badge de estado pendiente */
export const adminBadgePending =
  "inline-flex items-center bg-amber-100 border border-amber-200 text-amber-800 " +
  "dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300 " +
  "text-xs font-semibold rounded-full px-2.5 py-0.5";

/** Badge de estado error/crítico */
export const adminBadgeError =
  "inline-flex items-center bg-rose-100 border border-rose-200 text-rose-800 " +
  "dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300 " +
  "text-xs font-semibold rounded-full px-2.5 py-0.5";

/** Badge neutral (sin estado / desconocido) */
export const adminBadgeNeutral =
  "inline-flex items-center bg-[var(--bg-subtle)] border border-[var(--border-subtle)] " +
  "text-[var(--text-secondary)] text-xs font-semibold rounded-full px-2.5 py-0.5";

/** Badge de marca (categorías neutrales, no un estado) */
export const adminBadgeBrand =
  "inline-flex items-center bg-brand-primary/10 border border-brand-primary/25 " +
  "text-brand-primary text-xs font-semibold rounded-full px-2.5 py-0.5";

export const adminSectionLabel =
  "font-admin-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]";

/** Detalle lima mínimo: borde izquierdo de acento para cards/filas destacadas */
export const adminAccentBar = "border-l-2 border-[var(--admin-accent-lima)]";
