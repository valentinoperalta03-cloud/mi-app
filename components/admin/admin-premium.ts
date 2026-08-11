export const adminCard =
  "rounded-[var(--admin-card-radius)] border bg-[var(--admin-card-bg)] p-5 " +
  "border-[var(--admin-card-border)] shadow-[var(--admin-card-shadow)] " +
  "transition-all duration-200 hover:border-[var(--admin-card-border-hover)] hover:shadow-[var(--admin-card-shadow-hover)]";

export const adminKicker =
  "font-admin-mono text-[11px] font-semibold uppercase tracking-[0.12em] " +
  "text-[var(--admin-brand-primary)] dark:text-[var(--admin-accent-lima)]";

export const adminTitle =
  "font-admin-display text-2xl font-bold tracking-tight text-[var(--text-primary)] md:text-3xl";

export const adminSubtitle =
  "text-sm font-medium text-[var(--text-secondary)]";

export const adminPressable =
  "touch-manipulation transition-all duration-200 " +
  "active:scale-[0.98] hover:-translate-y-0.5";

export const adminPressableSubtle =
  "touch-manipulation transition-transform duration-150 active:scale-[0.97]";

/** Boton/link secundario "outline": borde y texto con contraste real en modo claro y oscuro. */
export const adminButtonSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-strong)] px-4 py-2.5 " +
  "text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-subtle)]";

export const adminCTAPrimary =
  "bg-brand-gradient text-white font-semibold rounded-[var(--admin-btn-radius)] px-4 py-2.5 border-none " +
  "shadow-[var(--admin-btn-shadow)] transition-all duration-200 " +
  "hover:brightness-105 hover:shadow-[var(--admin-btn-shadow-hover)] active:scale-[0.98]";

/** CTA destructivo (eliminar, dar de baja, desactivar) */
export const adminCTADanger =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors " +
  "border-[rgba(239,68,68,0.30)] bg-[rgba(239,68,68,0.10)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.16)]";

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

/** Empty state unificado */
export const adminEmptyState =
  "rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-10 text-center text-sm text-[var(--text-tertiary)]";

/** Badge/pill de acción destructiva */
export const adminBadgeDanger =
  "inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 " +
  "border-[var(--admin-alert-error-border)] bg-[var(--admin-alert-error-bg)]";

/** Badge/pill de acción de advertencia */
export const adminBadgeWarning =
  "inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold " +
  "border-[var(--admin-alert-warning-border)] bg-[var(--admin-alert-warning-bg)] text-[var(--admin-alert-warning-text)]";

/** Badge/pill de acción de éxito */
export const adminBadgeSuccess =
  "inline-flex items-center rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 " +
  "dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-300";

/** Bloque "Consejo": tip informativo con acento lima */
export const adminTip =
  "rounded-xl border-l-[3px] border-[var(--admin-accent-lima)] bg-[var(--admin-accent-lima-subtle)] " +
  "px-4 py-3 text-xs text-[var(--admin-status-active-text)] dark:text-[#d4e600]";
