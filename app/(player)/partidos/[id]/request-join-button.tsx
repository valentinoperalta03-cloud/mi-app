"use client";

import { useFormStatus } from "react-dom";
import { PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { requestToJoin } from "./actions";

function SubmitInner({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full ${PLAYER_PRIMARY_BUTTON} py-3.5 text-base disabled:opacity-60`}
    >
      {pending ? "Enviando…" : label}
    </button>
  );
}

export default function RequestJoinButton({
  matchId,
  levelOverride = false,
  submitLabel,
}: {
  matchId: string;
  levelOverride?: boolean;
  /** Texto del botón (p. ej. "Pagar y unirme" en partidos públicos). */
  submitLabel?: string;
}) {
  const label = submitLabel ?? "Solicitar unirse";
  return (
    <form action={requestToJoin} className="w-full">
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="level_override" value={levelOverride ? "true" : "false"} />
      <SubmitInner label={label} />
    </form>
  );
}
