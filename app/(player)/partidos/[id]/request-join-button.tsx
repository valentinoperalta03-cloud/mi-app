"use client";

import { useFormStatus } from "react-dom";
import { PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { requestToJoin } from "./actions";

function SubmitInner() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full ${PLAYER_PRIMARY_BUTTON} py-3.5 text-base disabled:opacity-60`}
    >
      {pending ? "Enviando…" : "Solicitar unirse"}
    </button>
  );
}

export default function RequestJoinButton({
  matchId,
  levelOverride = false,
}: {
  matchId: string;
  levelOverride?: boolean;
}) {
  return (
    <form action={requestToJoin} className="w-full">
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="level_override" value={levelOverride ? "true" : "false"} />
      <SubmitInner />
    </form>
  );
}
