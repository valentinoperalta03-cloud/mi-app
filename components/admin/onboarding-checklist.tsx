import Link from "next/link";
import { skipTrainingsAction } from "@/app/admin/config/actions";
import type { AdminOnboardingStatus } from "@/lib/admin/onboarding-status";

export type OnboardingChecklistProps = {
  status: AdminOnboardingStatus;
};

function getTip(status: AdminOnboardingStatus): string {
  const nextPhase = status.phases.find((p) => !p.completed);
  if (!nextPhase) return "";
  const tips: Record<string, string> = {
    info: "Completá la info del club para que los jugadores te encuentren.",
    canchas: "Creá una cancha y el sistema te pregunta si tenés más iguales — las genera automáticamente numeradas.",
    horarios: "Configurá los horarios en los que cada cancha está disponible para reservar.",
    cancelacion: "Definí con cuántas horas de anticipación se puede cancelar sin costo.",
    entrenamientos:
      "Si tenés clases o entrenamientos fijos, configurarlos acá bloquea esos horarios para que no aparezcan disponibles.",
    mp: "Conectar MP es necesario para recibir señas online. Sin esto los jugadores no pueden reservar.",
    sena: "La seña puede ser un monto fijo (ej: $5.000) o un porcentaje del turno (ej: 30%).",
    servicios: "Los servicios aparecen como pills en tu página pública. ¡Completá todos los que ofrecés!",
    identidad: "Agregar tus redes sociales ayuda a los jugadores a contactarte y encontrarte.",
  };
  return tips[nextPhase.id] ?? "";
}

export default function OnboardingChecklist({ status }: OnboardingChecklistProps) {
  if (status.allComplete) return null;

  const pct = status.totalCount > 0 ? (status.completedCount / status.totalCount) * 100 : 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--admin-card-border)] bg-[var(--admin-card-bg)] shadow-[var(--admin-card-shadow)]">
      {status.completedCount === 0 ? (
        <div className="bg-gradient-to-r from-[#0085FC] to-[#0461C4] px-6 py-5">
          <p className="mb-1 text-[11px] font-mono uppercase tracking-widest text-white/60">
            Bienvenido a PadeLibre
          </p>
          <h2 className="text-xl font-bold text-white">Configurá tu club en ~45 minutos</h2>
          <p className="mt-1 text-sm text-white/70">
            Seguí los pasos para activar tu página pública y empezar a recibir reservas online.
          </p>
        </div>
      ) : (
        <div className="border-b border-[var(--admin-card-border)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-0.5 text-[11px] font-mono uppercase tracking-widest text-[var(--text-tertiary)]">
                Configuración inicial
              </p>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {status.completedCount} de {status.totalCount} pasos completados
              </h2>
            </div>
            <div className="relative h-12 w-12">
              <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border-subtle)" strokeWidth="2.5" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="#CCFF00"
                  strokeWidth="2.5"
                  strokeDasharray={`${pct} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[var(--text-primary)]">
                {Math.round(pct)}%
              </span>
            </div>
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
            <div
              className="h-full rounded-full bg-[#CCFF00] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="divide-y divide-[var(--admin-card-border)]">
        {status.phases.map((phase, idx) => {
          const isLocked = idx < 3 ? idx > 0 && !status.phases[idx - 1].completed : false;
          const isNext = !phase.completed && !isLocked;

          return (
            <div
              key={phase.id}
              className={`flex items-center gap-4 px-6 py-4 transition ${isLocked ? "opacity-40" : ""} ${
                isNext ? "bg-[#0085FC]/[0.04]" : ""
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                  phase.completed
                    ? "bg-[#CCFF00] text-[#0A1628]"
                    : isNext
                      ? "bg-[#0085FC] text-white"
                      : "bg-[var(--bg-subtle)] text-[var(--text-tertiary)]"
                }`}
              >
                {phase.completed ? "✓" : phase.phase}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-semibold ${
                    phase.completed ? "text-[var(--text-tertiary)] line-through" : "text-[var(--text-primary)]"
                  }`}
                >
                  {phase.title}
                </p>
                {!phase.completed ? (
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{phase.description}</p>
                ) : null}
                {phase.id === "entrenamientos" && !phase.completed && !isLocked ? (
                  <form action={skipTrainingsAction}>
                    <button
                      type="submit"
                      className="mt-1 text-xs text-[var(--text-tertiary)] underline hover:text-[var(--text-secondary)]"
                    >
                      No registramos entrenamientos
                    </button>
                  </form>
                ) : null}
              </div>

              {!phase.completed && !isLocked ? (
                <Link
                  href={phase.href}
                  className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    isNext
                      ? "bg-[#0085FC] text-white hover:bg-[#0461C4]"
                      : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  {isNext ? "Ir ahora →" : "Configurar"}
                </Link>
              ) : isLocked ? (
                <span className="shrink-0 text-xs text-[var(--text-tertiary)]">🔒</span>
              ) : null}
            </div>
          );
        })}
      </div>

      {status.completedCount > 0 && !status.allComplete ? (
        <div className="border-t border-[var(--admin-card-border)] bg-[var(--bg-subtle)] px-6 py-3">
          <p className="text-xs text-[var(--text-tertiary)]">💡 {getTip(status)}</p>
        </div>
      ) : null}
    </div>
  );
}
