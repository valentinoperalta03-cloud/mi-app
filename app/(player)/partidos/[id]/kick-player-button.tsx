"use client";

import { useTransition } from "react";
import { kickPlayerFromMatch } from "./actions";

type Props = {
  matchId: string;
  playerId: string;
  playerName: string;
};

export default function KickPlayerButton({ matchId, playerId, playerName }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(`¿Expulsar a ${playerName} del partido?`)) return;
        startTransition(async () => {
          const result = await kickPlayerFromMatch(matchId, playerId);
          if (!result.ok) {
            window.alert(result.error ?? "No se pudo expulsar al jugador.");
          }
        });
      }}
      className="text-[10px] font-semibold text-rose-300 underline-offset-2 hover:underline disabled:opacity-50"
    >
      {isPending ? "Expulsando…" : "Expulsar"}
    </button>
  );
}
