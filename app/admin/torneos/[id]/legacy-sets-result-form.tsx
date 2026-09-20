"use client";

import { useState, useTransition } from "react";
import { SetsResultForm, type SetsMatchFormat } from "./competitive-panel";
import { saveTournamentMatchAction } from "./actions";

/**
 * Carga de resultado a sets reales para partidos de americano/eliminación
 * (match_format 'set' | 'tres_sets') — mismo componente de captura que usa
 * el motor V2 (zonas), reutilizado acá para no duplicar la UI de sets.
 */
export function LegacySetsResultForm({
  tournamentId,
  matchId,
  format,
}: {
  tournamentId: string;
  matchId: string;
  format: SetsMatchFormat;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <SetsResultForm
        format={format}
        pending={pending}
        onSubmit={(sets) => {
          setError(null);
          startTransition(async () => {
            const fd = new FormData();
            fd.set("kind", "sets");
            fd.set("sets_json", JSON.stringify(sets));
            const res = await saveTournamentMatchAction(tournamentId, matchId, fd);
            if (!res.ok) setError(res.message);
          });
        }}
      />
      {error ? <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  );
}
