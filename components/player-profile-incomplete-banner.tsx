import Link from "next/link";
import { CircleAlert, CircleCheck } from "lucide-react";

type Props = {
  hasName: boolean;
  hasGender: boolean;
  hasOnboarding: boolean;
};

const STEPS = [
  { key: "hasName", label: "Tu nombre", description: "Cómo te van a ver los demás jugadores" },
  { key: "hasGender", label: "Tu género", description: "Necesario para los partidos mixtos y categorías" },
  { key: "hasOnboarding", label: "Tu nivel de juego", description: "Para encontrarte partidos acordes a vos" },
] as const;

export default function PlayerProfileIncompleteBanner({ hasName, hasGender, hasOnboarding }: Props) {
  const values = { hasName, hasGender, hasOnboarding };
  const completedCount = [hasName, hasGender, hasOnboarding].filter(Boolean).length;
  const totalCount = 3;
  const pct = Math.round((completedCount / totalCount) * 100);

  return (
    <section className="space-y-4 overflow-hidden rounded-3xl border border-[#0585FC]/25 bg-gradient-to-br from-slate-50 via-white to-sky-50/50 p-5 ring-1 ring-[#0585FC]/10 dark:border-sky-900/30 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/20 dark:ring-sky-500/10">
      <header className="space-y-1">
        <p className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          👋 ¡Completá tu perfil para jugar!
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Necesitás terminarlo antes de crear o unirte a partidos.
        </p>
      </header>

      <div className="rounded-2xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
        🚫 No podés crear ni buscar partidos hasta completar el perfil.
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span>Progreso</span>
          <span className="text-[#0585FC] dark:text-sky-400">{completedCount}/{totalCount} completados</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#0585FC] to-cyan-500 transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {STEPS.map((step) => {
          const done = values[step.key];
          return (
            <li
              key={step.key}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                done
                  ? "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/25"
                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60"
              }`}
            >
              {done ? (
                <CircleCheck className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden />
              ) : (
                <CircleAlert className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{step.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <Link
        href="/onboarding"
        className="flex w-full items-center justify-center rounded-2xl bg-[#0585FC] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0461C4] active:scale-[0.98]"
      >
        Completar perfil ahora →
      </Link>
    </section>
  );
}
