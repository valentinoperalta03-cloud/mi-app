"use client";

import { useTransition } from "react";
import { adminCTAPrimary } from "@/components/admin/admin-premium";
import { saveTournamentMatchFormAction } from "./actions";

/** Carga de resultado por tiempo (match_format='tiempo'): solo se elige quién ganó, sin sets. */
export function WinnerPickerButtons({
  tournamentId,
  matchId,
  pair1Name,
  pair2Name,
}: {
  tournamentId: string;
  matchId: string;
  pair1Name: string;
  pair2Name: string;
}) {
  const [pending, startTransition] = useTransition();

  function pick(winner: 1 | 2) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("tournament_id", tournamentId);
      fd.set("match_id", matchId);
      fd.set("sets_json", "[]");
      fd.set("pair1_score", winner === 1 ? "1" : "0");
      fd.set("pair2_score", winner === 2 ? "1" : "0");
      await saveTournamentMatchFormAction(fd);
    });
  }

  return (
    <div className="mt-2">
      <p className="mb-1 text-xs font-semibold text-[var(--text-tertiary)]">
        ¿Quién ganó?
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => pick(1)}
          className={`${adminCTAPrimary} px-2 py-1 text-xs disabled:opacity-50`}
        >
          {pair1Name}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => pick(2)}
          className={`${adminCTAPrimary} px-2 py-1 text-xs disabled:opacity-50`}
        >
          {pair2Name}
        </button>
      </div>
    </div>
  );
}
