"use client";

import { buildAmericanoRanking, type MatchForRanking } from "@/lib/tournament/ranking";

type Props = {
  matches: MatchForRanking[];
  pairNames: Record<string, string>;
};

export function AmericanoLeaderboard({ matches, pairNames }: Props) {
  const ranking = buildAmericanoRanking(matches);
  if (ranking.length === 0) return null;

  return (
    <section>
      <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">Tabla de posiciones</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--border-subtle)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
              <th className="px-3 py-2 text-left font-admin-mono text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">#</th>
              <th className="px-3 py-2 text-left font-admin-mono text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Pareja</th>
              <th className="px-3 py-2 text-center font-admin-mono text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">J</th>
              <th className="px-3 py-2 text-center font-admin-mono text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">G</th>
              <th className="px-3 py-2 text-center font-admin-mono text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">P</th>
              <th className="px-3 py-2 text-center font-admin-mono text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Sets</th>
              <th className="px-3 py-2 text-center font-admin-mono text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Pts</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((row, i) => (
              <tr
                key={row.pairId}
                className={`border-b border-[var(--border-subtle)] last:border-0 ${
                  i === 0 ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "bg-[var(--bg-card)]"
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs text-[var(--text-tertiary)]">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-[var(--text-secondary)]">
                  {pairNames[row.pairId] ?? "—"}
                </td>
                <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-[var(--text-secondary)]">{row.played}</td>
                <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-emerald-700 dark:text-emerald-300">{row.won}</td>
                <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-rose-600 dark:text-rose-400">{row.lost}</td>
                <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                  {row.setsFor}/{row.setsAgainst}
                </td>
                <td className="px-3 py-2 text-center font-mono text-xs font-bold tabular-nums text-[var(--text-primary)]">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">J=Jugados G=Ganados P=Perdidos Sets=GF/GC Pts=Puntos</p>
    </section>
  );
}
