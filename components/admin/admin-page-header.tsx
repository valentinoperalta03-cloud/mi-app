import type { ReactNode } from "react";

export default function AdminPageHeader({
  kicker,
  title,
  subtitle,
  action,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
      <div className="space-y-1.5">
        {kicker ? (
          <p className="font-admin-mono text-[11px] font-semibold uppercase tracking-[0.10em] text-[var(--admin-brand-primary)] dark:text-[var(--admin-accent-lima)]">
            {kicker}
          </p>
        ) : null}
        <h1 className="font-admin-display text-[28px] font-bold text-[var(--text-primary)]">{title}</h1>
        {subtitle ? <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
