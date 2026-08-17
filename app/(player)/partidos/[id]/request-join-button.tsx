"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useTransition } from "react";
import { nativeOpenUrl } from "@/lib/native-open";
import { PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { requestToJoin } from "./actions";

export default function RequestJoinButton({
  matchId,
  levelOverride = false,
  submitLabel,
  team,
}: {
  matchId: string;
  levelOverride?: boolean;
  /** Texto del botón (p. ej. "Pagar y unirme" en partidos públicos). */
  submitLabel?: string;
  /** Equipo al unirse (obligatorio en el flujo desde el detalle con selector). */
  team?: 1 | 2;
}) {
  const [isPending, startTransition] = useTransition();
  const label = submitLabel ?? "Solicitar unirse";

  function handleClick() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("match_id", matchId);
        fd.set("level_override", levelOverride ? "true" : "false");
        if (team != null) fd.set("team", String(team));

        const result = await requestToJoin(fd);

        if (result && "needsPayment" in result && result.mpUrl) {
          await nativeOpenUrl(result.mpUrl);
        }
        // Si no devuelve nada → la action hizo redirect() internamente
      } catch (err) {
        if (isRedirectError(err)) throw err;
        console.error("[RequestJoinButton]", err);
      }
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      className={`w-full ${PLAYER_PRIMARY_BUTTON} py-3.5 text-base disabled:opacity-60`}
    >
      {isPending ? "Procesando..." : label}
    </button>
  );
}
