"use client";

import { useState, useTransition } from "react";
import { adminBadgeLima, adminCTAPrimary } from "@/components/admin/admin-premium";
import { autoScheduleTournamentAction } from "./actions";

/**
 * "Generar programación" (sección 11 del prompt maestro): asigna
 * automáticamente todos los partidos con parejas ya definidas y sin
 * horario, usando el pool de disponibilidad del torneo. No reemplaza el
 * editor visual — es un punto de partida masivo; después se puede
 * reordenar partido por partido desde el editor (drag-and-drop / mobile).
 */
export function AutoSchedulePanel({ tournamentId, pendingCount }: { tournamentId: string; pendingCount: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ message: string; scheduled: number; unscheduled: Array<{ label: string; reason: string }> } | null>(null);

  if (pendingCount === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        {pendingCount} partido{pendingCount === 1 ? "" : "s"} listo{pendingCount === 1 ? "" : "s"} para programar
      </p>
      <p className="mt-1 text-xs text-[var(--text-tertiary)]">
        Asigna cancha, fecha y hora automáticamente según la disponibilidad del torneo, respetando ocupaciones reales y que una
        pareja no juegue dos partidos a la vez.
      </p>
      <button
        type="button"
        disabled={pending}
        className={`${adminCTAPrimary} mt-3 disabled:opacity-50`}
        onClick={() => {
          setResult(null);
          start(async () => {
            const res = await autoScheduleTournamentAction(tournamentId);
            setResult({ message: res.message, scheduled: res.scheduled, unscheduled: res.unscheduled });
          });
        }}
      >
        {pending ? "Programando…" : "⚡ Generar programación"}
      </button>

      {result ? (
        <div className="mt-3 space-y-2">
          {/* Éxito total (adminBadgeLima) SOLO si no quedó nada pendiente — una
              programación parcial nunca se muestra como éxito completo. */}
          {result.unscheduled.length === 0 ? (
            <p className={adminBadgeLima}>✓ {result.message}</p>
          ) : (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                ⚠ Programación parcial: {result.scheduled} programado{result.scheduled === 1 ? "" : "s"}, {result.unscheduled.length} pendiente
                {result.unscheduled.length === 1 ? "" : "s"}.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300">
                {result.unscheduled.map((u, i) => (
                  <li key={i}>
                    • {u.label}: {u.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
