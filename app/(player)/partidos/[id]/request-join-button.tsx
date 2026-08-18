"use client";

import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { nativeOpenUrl } from "@/lib/native-open";
import { PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { requestToJoin } from "./actions";

function IncompleteProfileModalButton({ nextPath, label }: { nextPath: string; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full ${PLAYER_PRIMARY_BUTTON} py-3.5 text-base`}
      >
        {label}
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-t-3xl bg-[var(--bg-card)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] border-t border-[var(--border-subtle)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-center mb-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0085FC]/15">
                    <span className="text-2xl">👤</span>
                  </div>
                </div>
                <h2 className="text-center text-[18px] font-bold text-[var(--text-primary)] mb-2">
                  Completá tu perfil
                </h2>
                <p className="text-center text-sm text-[var(--text-tertiary)] leading-relaxed mb-6">
                  Para unirte a partidos necesitamos saber quién sos. Solo te lleva 1 minuto.
                </p>
                <Link
                  href={`/completar-perfil?next=${encodeURIComponent(nextPath)}`}
                  className={`flex w-full items-center justify-center rounded-2xl ${PLAYER_PRIMARY_BUTTON} py-3.5 text-sm font-bold mb-3`}
                >
                  Completar mi perfil →
                </Link>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] py-3 text-sm font-semibold text-[var(--text-secondary)]"
                >
                  Ahora no
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export default function RequestJoinButton({
  matchId,
  levelOverride = false,
  submitLabel,
  team,
  profileComplete = true,
}: {
  matchId: string;
  levelOverride?: boolean;
  /** Texto del botón (p. ej. "Pagar y unirme" en partidos públicos). */
  submitLabel?: string;
  /** Equipo al unirse (obligatorio en el flujo desde el detalle con selector). */
  team?: 1 | 2;
  profileComplete?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const label = submitLabel ?? "Solicitar unirse";

  if (!profileComplete) {
    return <IncompleteProfileModalButton nextPath={`/partidos/${matchId}`} label={label} />;
  }

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
