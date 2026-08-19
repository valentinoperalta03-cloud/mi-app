"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useTransition } from "react";
import { adminCard } from "@/components/admin/admin-premium";
import { cancelarPartidoDesdeAdmin } from "./actions";
import type { OpenMatchData } from "./reservas-tabs";

function dateLabel(ymd: string): string {
  try {
    const label = format(parseISO(`${ymd}T12:00:00`), "EEE d MMM", { locale: es });
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return ymd;
  }
}

function genderLabel(g: OpenMatchData["genderCategory"]): string {
  return g === "masculino" ? "Masculino" : g === "femenino" ? "Femenino" : "Mixto";
}

export default function OpenMatchCard({
  match,
  onAddPlayer,
}: {
  match: OpenMatchData;
  onAddPlayer: () => void;
}) {
  const [isCancelling, startCancel] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const team1 = match.participants.filter((p) => p.team === 1);
  const team2 = match.participants.filter((p) => p.team === 2);
  const playersCount = match.participants.length;
  const freeSlots = Math.max(0, 4 - playersCount);

  function handleCancel() {
    setError(null);
    startCancel(async () => {
      const result = await cancelarPartidoDesdeAdmin(match.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
    });
  }

  return (
    <div className={`${adminCard} space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-[var(--text-primary)]">{match.courtName}</p>
            {match.createdByClub ? (
              <span className="rounded-full bg-[#CCFF00]/20 px-2 py-0.5 text-[10px] font-bold text-[#7a8f00] dark:text-[#CCFF00]">
                Creado por el club
              </span>
            ) : (
              <span className="rounded-full bg-[#0085FC]/20 px-2 py-0.5 text-[10px] font-bold text-[#0085FC]">
                Partido de jugador
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-tertiary)]">
            {dateLabel(match.scheduledDate)} · {match.scheduledTime || "--:--"}hs
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-[var(--text-primary)]">{playersCount}/4</p>
          {freeSlots > 0 ? (
            <p className="text-xs text-emerald-500">
              {freeSlots} libre{freeSlots !== 1 ? "s" : ""}
            </p>
          ) : (
            <p className="text-xs text-[var(--text-tertiary)]">Completo</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
          {genderLabel(match.genderCategory)}
        </span>
        {match.categoryRange.map((cat) => (
          <span
            key={cat}
            className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]"
          >
            {cat}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[team1[0], team1[1], team2[0], team2[1]].map((p, slot) => (
          <div
            key={p?.id ?? `empty-${slot}`}
            className={`flex items-center gap-2 rounded-xl border p-2 ${
              p
                ? "border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                : "border-dashed border-[var(--border-subtle)] bg-transparent"
            }`}
          >
            {p ? (
              <>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0085FC]/20 text-xs font-bold text-[#0085FC]">
                  {p.name[0]?.toUpperCase() ?? "J"}
                </div>
                <p className="truncate text-xs font-medium text-[var(--text-primary)]">{p.name}</p>
              </>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">Lugar libre</p>
            )}
          </div>
        ))}
      </div>

      {error ? <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p> : null}

      <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3">
        {freeSlots > 0 ? (
          <button
            type="button"
            onClick={onAddPlayer}
            className="flex-1 rounded-xl border border-[var(--border-subtle)] py-2 text-xs font-semibold text-[var(--text-primary)]"
          >
            + Agregar jugador
          </button>
        ) : null}
        {confirming ? (
          <div className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={isCancelling}
              onClick={handleCancel}
              className="flex-1 rounded-xl border border-rose-300 bg-rose-50 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
            >
              {isCancelling ? "Cancelando…" : "Confirmar cancelación"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
            >
              Volver
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 dark:border-rose-900 dark:text-rose-400"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
