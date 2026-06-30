import Link from "next/link";
import { UserCircle } from "lucide-react";

type Props = {
  hasName: boolean;
  hasGender: boolean;
  hasOnboarding: boolean;
};

export default function PlayerProfileIncompleteBanner({ hasName, hasGender, hasOnboarding }: Props) {
  const completedCount = [hasName, hasGender, hasOnboarding].filter(Boolean).length;
  const pct = Math.round((completedCount / 3) * 100);

  return (
    <section className="overflow-hidden rounded-3xl border border-[#0585FC]/25 bg-[var(--bg-card)] p-5 ring-1 ring-[#0585FC]/10">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0585FC]/10">
          <UserCircle className="h-6 w-6 text-[#0585FC]" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">Activá tu cuenta</p>
            <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">
              Para unirte o crear tu primer partido necesitás completar tu perfil con tu nombre, género y nivel de juego.
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
              <span>Perfil completo</span>
              <span className="font-semibold text-[#0585FC]">{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-[#0585FC] transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0585FC] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0461C4] active:scale-[0.98]"
          >
            Completar perfil →
          </Link>
        </div>
      </div>
    </section>
  );
}
