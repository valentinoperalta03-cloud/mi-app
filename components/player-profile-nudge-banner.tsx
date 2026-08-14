import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function PlayerProfileNudgeBanner() {
  return (
    <Link
      href="/completar-perfil"
      className="flex items-center gap-3 rounded-2xl bg-[var(--bg-subtle)] px-4 py-2.5 text-sm transition active:scale-[0.99]"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-lima text-[11px] font-bold text-black">
        !
      </span>
      <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">Completá tu perfil para una mejor experiencia</span>
      <ChevronRight size={16} className="shrink-0 text-[var(--text-tertiary)]" aria-hidden />
    </Link>
  );
}
