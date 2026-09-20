"use client";

import { useState } from "react";

export type PlayerTab = { key: string; label: string; content: React.ReactNode };

/**
 * Pestañas de la vista jugador (punto 4 del cierre / sección 15 del prompt
 * maestro): información, categorías, inscriptos, zonas, posiciones,
 * partidos, resultados, cuadro — el caller solo pasa las que correspondan
 * según el tipo/estado real del torneo, nunca una lista fija.
 */
export function PlayerTournamentTabs({ tabs }: { tabs: PlayerTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  if (tabs.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              (current?.key ?? "") === t.key
                ? "border-transparent bg-[#0085FC] text-white"
                : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{current?.content}</div>
    </div>
  );
}
