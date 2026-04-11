import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type AdminBackLinkProps = {
  href?: string;
  label?: string;
};

export default function AdminBackLink({
  href = "/admin/dashboard",
  label = "Volver al inicio",
}: AdminBackLinkProps) {
  return (
    <Link
      href={href}
      prefetch
      className="group mb-2 inline-flex w-fit touch-manipulation items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-200 hover:scale-[1.02] hover:border-sky-200/80 hover:text-sky-700 active:scale-[0.96] md:mb-4 md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-sm md:shadow-none"
    >
      <ChevronLeft
        size={16}
        strokeWidth={2}
        className="shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5 md:h-[18px] md:w-[18px]"
      />
      {label}
    </Link>
  );
}
