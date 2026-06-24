import Link from "next/link";

type EmptyStateCardProps = {
  title: string;
  subtitle: string;
  ctaHref?: string;
  ctaLabel?: string;
  icon?: "padel" | "calendar" | "users" | "trophy" | "search" | "default";
};

const icons = {
  padel: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 18 Q24 15 40 18" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M8 24 Q24 21 40 24" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M8 30 Q24 27 40 30" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ),
  calendar: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="6" y="10" width="36" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M6 20h36" stroke="currentColor" strokeWidth="2" />
      <path d="M16 6v8M32 6v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="30" r="2" fill="currentColor" />
      <circle cx="24" cy="30" r="2" fill="currentColor" />
      <circle cx="32" cy="30" r="2" fill="currentColor" />
    </svg>
  ),
  users: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="18" cy="16" r="6" stroke="currentColor" strokeWidth="2" />
      <circle cx="30" cy="16" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="M6 40c0-8 5-12 12-12s12 4 12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M30 28c4 0 12 2 12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  trophy: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path d="M14 8h20v16a10 10 0 01-20 0V8z" stroke="currentColor" strokeWidth="2" />
      <path d="M14 14H8a6 6 0 006 6M34 14h6a6 6 0 01-6 6" stroke="currentColor" strokeWidth="2" />
      <path d="M24 34v6M16 40h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="22" cy="22" r="14" stroke="currentColor" strokeWidth="2" />
      <path d="M32 32l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  default: (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2" />
      <path d="M24 16v8M24 30v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

export default function EmptyStateCard({
  title,
  subtitle,
  ctaHref,
  ctaLabel,
  icon = "default",
}: EmptyStateCardProps) {
  return (
    <section className="flex min-h-[50vh] items-center justify-center px-4">
      <article className="w-full max-w-sm text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#0585FC]/8 text-[#0585FC] dark:bg-[#0585FC]/10">
            {icons[icon]}
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 max-w-xs mx-auto">{subtitle}</p>
        </div>

        {/* CTA */}
        {ctaHref && ctaLabel && (
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(5,133,252,0.4)] active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
          >
            {ctaLabel}
          </Link>
        )}
      </article>
    </section>
  );
}
