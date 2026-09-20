import { adminKicker } from "@/components/admin/admin-premium";
import { formatMinutes, type TournamentDemand } from "@/lib/tournament/v2/demand";

const DEFAULT_SLOT_MINUTES = 90;

/**
 * Sección 5 del prompt maestro: cálculo real de partidos/horas-cancha,
 * incluyendo "zonas + eliminación" (antes solo se calculaba en el wizard
 * para americano/eliminación). Vive en el detalle del torneo — no en el
 * wizard — porque para "zonas" la demanda depende de zonas ya generadas o,
 * si todavía no, de una estimación a cupo completo que se deja explícita.
 */
export function DemandCalculatorCard({ demand, availableSlots }: { demand: TournamentDemand; availableSlots: number }) {
  const relevantCategories = demand.categories.filter((c) => c.plan);
  if (relevantCategories.length === 0) return null;

  const availableMinutes = availableSlots * DEFAULT_SLOT_MINUTES;
  const deficitMinutes = Math.max(0, demand.totalMinutes - availableMinutes);
  const enough = deficitMinutes === 0;

  return (
    <div
      className={`rounded-2xl border p-4 ${enough ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20"}`}
    >
      <p className={adminKicker}>Cálculo de demanda horaria{demand.anyEstimated ? " (parcialmente estimado)" : ""}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
        {demand.totalMatches} partidos · ~{formatMinutes(demand.totalMinutes)} de cancha necesarias
      </p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">
        Disponibilidad configurada: {availableSlots} franja{availableSlots === 1 ? "" : "s"} (~{formatMinutes(availableMinutes)}, estimando {DEFAULT_SLOT_MINUTES}{" "}
        min por franja).
      </p>

      <ul className="mt-2 space-y-0.5 text-xs text-[var(--text-tertiary)]">
        {relevantCategories.map((c) => (
          <li key={c.name}>
            {c.name}: {c.plan!.totalMatches} partidos · ~{formatMinutes(c.plan!.totalMinutes)}
            {c.note ? ` (${c.note})` : ""}
          </li>
        ))}
      </ul>

      {enough ? (
        <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">✓ La disponibilidad configurada alcanza.</p>
      ) : (
        <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
          ⚠ Faltan ~{formatMinutes(deficitMinutes)} de cancha. Agregá franjas/canchas/días desde &quot;Disponibilidad del torneo&quot;.
        </p>
      )}
    </div>
  );
}
