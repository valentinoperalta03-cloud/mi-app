import Link from "next/link";

type EmptyStateCardProps = {
  title: string;
  subtitle: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export default function EmptyStateCard({
  title,
  subtitle,
  ctaHref = "/partidos/nuevo",
  ctaLabel = "Armar el primer partido",
}: EmptyStateCardProps) {
  return (
    <section className="flex min-h-[62vh] items-center justify-center">
      <article className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white px-8 py-12 text-center shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800/60">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-14 w-14 text-slate-300 dark:text-slate-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6.5 4.5l13 13" />
            <path d="M17.5 4.5l-13 13" />
            <rect x="8.2" y="2.8" width="3.6" height="3.6" rx="0.8" />
            <rect x="12.2" y="17.6" width="3.6" height="3.6" rx="0.8" />
          </svg>
        </div>

        <h2 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>

        <Link
          href={ctaHref}
          className="mt-8 inline-flex w-full items-center justify-center rounded-3xl bg-gradient-to-r from-[#0585FC] to-cyan-500 px-6 py-3 text-base font-semibold text-white shadow-sm transition-all duration-300 hover:opacity-95 active:scale-[0.99]"
        >
          {ctaLabel}
        </Link>
      </article>
    </section>
  );
}
