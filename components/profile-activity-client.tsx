"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { RatePlayerDrawer } from "@/components/rate-player-drawer";
import type { FinishedMatchActivity } from "@/lib/player-match-history";

export function ProfileActivityClient({ activities }: { activities: FinishedMatchActivity[] }) {
  const [drawer, setDrawer] = useState<{
    matchId: string;
    peers: FinishedMatchActivity["peers"];
  } | null>(null);

  if (activities.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-slate-200/90 bg-white/60 px-4 py-6 text-center text-sm text-slate-500">
        Cuando termines partidos registrados en el sistema, vas a ver el historial y podrás confirmar
        niveles de tus rivales.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {activities.map((a) => {
          const when = format(parseISO(a.matchDateIso), "EEE d MMM yyyy · HH:mm", { locale: es });
          const unratedPeers = a.peers.filter((p) => a.unratedPeerIds.includes(p.player_id));

          return (
            <article
              key={a.resultId}
              className="rounded-3xl border border-slate-200/80 bg-white px-4 py-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">{a.clubName}</p>
                  <p className="text-xs font-medium text-slate-500">{a.courtName}</p>
                  <p className="mt-1 text-xs text-slate-500">{when}</p>
                </div>
                {a.scoreLabel ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tabular-nums text-slate-700">
                    {a.scoreLabel}
                  </span>
                ) : null}
              </div>

              {a.peers.length > 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  Con: {a.peers.map((p) => p.name).join(", ")}
                </p>
              ) : null}

              {unratedPeers.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setDrawer({
                      matchId: a.matchId,
                      peers: unratedPeers,
                    })
                  }
                  className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Confirmar nivel
                </button>
              ) : (
                <p className="mt-3 text-xs font-medium text-emerald-700/90">Nivel confirmado</p>
              )}
            </article>
          );
        })}
      </div>

      <RatePlayerDrawer
        open={drawer != null}
        matchId={drawer?.matchId ?? ""}
        peers={drawer?.peers ?? []}
        onClose={() => setDrawer(null)}
      />
    </>
  );
}
