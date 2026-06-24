import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PlayerBackButton({
  href,
  label = "Volver",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-card)] text-[#0585FC] shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] transition active:scale-95 dark:ring-white/10"
      aria-label={label}
    >
      <ChevronLeft size={22} aria-hidden />
    </Link>
  );
}

export function PlayerStackHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  className = "mb-6",
}: {
  backHref: string;
  backLabel?: string;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <header className={`flex items-center gap-3 ${className}`}>
      <PlayerBackButton href={backHref} label={backLabel} />
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">{title}</h1>
        {subtitle ? <p className="text-sm text-[var(--text-tertiary)]">{subtitle}</p> : null}
      </div>
    </header>
  );
}
