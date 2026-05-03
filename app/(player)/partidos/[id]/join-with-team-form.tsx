"use client";

import { useState } from "react";
import RequestJoinButton from "./request-join-button";

type Props = {
  matchId: string;
  team1Count: number;
  team2Count: number;
  submitLabel?: string;
  levelOverride?: boolean;
};

export default function JoinWithTeamForm({
  matchId,
  team1Count,
  team2Count,
  submitLabel,
  levelOverride = false,
}: Props) {
  const [team, setTeam] = useState<1 | 2 | null>(null);
  const t1Full = team1Count >= 2;
  const t2Full = team2Count >= 2;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Elegí tu equipo (2 jugadores por lado)</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={t1Full}
          onClick={() => setTeam(1)}
          className={`rounded-2xl border-2 px-3 py-3 text-sm font-semibold transition ${
            team === 1
              ? "border-[#0585FC] bg-[#0585FC]/10 text-[#0461C4]"
              : "border-slate-200 bg-white text-slate-800 hover:border-[#0585FC]/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Equipo 1
          <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
            {team1Count}/2 jugadores
          </span>
        </button>
        <button
          type="button"
          disabled={t2Full}
          onClick={() => setTeam(2)}
          className={`rounded-2xl border-2 px-3 py-3 text-sm font-semibold transition ${
            team === 2
              ? "border-[#0585FC] bg-[#0585FC]/10 text-[#0461C4]"
              : "border-slate-200 bg-white text-slate-800 hover:border-[#0585FC]/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Equipo 2
          <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
            {team2Count}/2 jugadores
          </span>
        </button>
      </div>
      {team ? (
        <RequestJoinButton matchId={matchId} team={team} submitLabel={submitLabel} levelOverride={levelOverride} />
      ) : (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">Seleccioná un equipo para continuar.</p>
      )}
    </div>
  );
}
