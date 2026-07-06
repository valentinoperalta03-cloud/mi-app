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
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tabla de posiciones</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Pareja</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">J</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">G</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">P</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Sets</th>
              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Pts</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((row, i) => (
              <tr
                key={row.pairId}
                className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                  i === 0 ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "bg-white dark:bg-slate-950"
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs text-slate-400">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                  {pairNames[row.pairId] ?? "—"}
                </td>
                <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">{row.played}</td>
                <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-emerald-700 dark:text-emerald-300">{row.won}</td>
                <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-rose-600 dark:text-rose-400">{row.lost}</td>
                <td className="px-3 py-2 text-center font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                  {row.setsFor}/{row.setsAgainst}
                </td>
                <td className="px-3 py-2 text-center font-mono text-xs font-bold tabular-nums text-slate-900 dark:text-white">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">J=Jugados G=Ganados P=Perdidos Sets=GF/GC Pts=Puntos</p>
    </section>
  );
}
