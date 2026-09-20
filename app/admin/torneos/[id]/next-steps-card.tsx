import { adminBadgePending, adminKicker } from "@/components/admin/admin-premium";

/**
 * "Próximos pasos" (punto 4 del cierre / sección 17 del prompt maestro):
 * guía contextual según el estado real del torneo — no una lista fija.
 * Las acciones inválidas para el estado actual ya no se muestran habilitadas
 * en otras secciones; este panel resume qué falta antes de seguir.
 */
export function NextStepsCard({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null;
  return (
    <section className="rounded-2xl border border-[#0085FC]/20 bg-[#0085FC]/[0.03] p-4">
      <p className={adminKicker}>Próximos pasos</p>
      <ul className="mt-2 space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className={`${adminBadgePending} block w-fit`}>
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}
