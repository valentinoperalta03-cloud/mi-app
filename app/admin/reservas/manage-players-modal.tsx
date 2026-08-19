"use client";

import { useState, useTransition } from "react";
import { adminButtonSecondary } from "@/components/admin/admin-premium";
import { agregarJugadorDesdeAdmin, quitarJugadorDesdeAdmin } from "./actions";
import type { OpenMatchData } from "./reservas-tabs";

const fieldClass =
  "w-full rounded-lg border border-[var(--border-subtle)] bg-transparent px-4 py-3 text-sm transition-colors " +
  "placeholder:text-[var(--text-tertiary)] focus:border-blue-500 focus:outline-none focus:ring-2 " +
  "focus:ring-blue-500/20 dark:focus:border-blue-400 dark:focus:ring-blue-400/20";

export default function ManagePlayersModal({ match, onClose }: { match: OpenMatchData; onClose: () => void }) {
  const [name, setName] = useState("");
  const [team, setTeam] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const team1Count = match.participants.filter((p) => p.team === 1).length;
  const team2Count = match.participants.filter((p) => p.team === 2).length;
  const isFull = match.participants.length >= 4;
  const teamFull = team === 1 ? team1Count >= 2 : team2Count >= 2;

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await agregarJugadorDesdeAdmin({ matchId: match.id, guestName: name.trim(), team });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      onClose();
    });
  }

  function handleRemove(participantId: string) {
    setError(null);
    setRemovingId(participantId);
    startTransition(async () => {
      const result = await quitarJugadorDesdeAdmin({ matchId: match.id, participantId });
      if (!result.ok) {
        setError(result.error);
      }
      setRemovingId(null);
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto" style={{ borderRadius: 16, background: "var(--bg-card)" }}>
        <div
          style={{ background: "linear-gradient(135deg, #0085FC, #0461C4)", borderRadius: "16px 16px 0 0", padding: "20px 24px" }}
        >
          <h2 className="font-admin-display text-lg font-bold text-white">Jugadores del partido</h2>
          <p className="mt-1 text-sm text-white/80">
            {match.courtName} · {match.scheduledTime}hs
          </p>
        </div>

        <div style={{ padding: 24 }} className="space-y-5">
          <div className="space-y-2">
            <span className="block text-sm font-medium text-[var(--text-secondary)]">Jugadores actuales</span>
            {match.participants.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">Sin jugadores todavía.</p>
            ) : (
              <ul className="space-y-2">
                {match.participants.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2"
                  >
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {p.name} <span className="text-xs text-[var(--text-tertiary)]">· Equipo {p.team ?? "—"}</span>
                    </span>
                    <button
                      type="button"
                      disabled={isPending && removingId === p.id}
                      onClick={() => handleRemove(p.id)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50 dark:text-rose-400"
                    >
                      {isPending && removingId === p.id ? "Quitando…" : "Quitar"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!isFull ? (
            <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
              <span className="block text-sm font-medium text-[var(--text-secondary)]">Agregar jugador del club</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del jugador (opcional)"
                className={fieldClass}
              />
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--text-tertiary)]">Equipo</span>
                <div className="grid grid-cols-2 gap-2">
                  {([1, 2] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={t === 1 ? team1Count >= 2 : team2Count >= 2}
                      onClick={() => setTeam(t)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-30 ${
                        team === t
                          ? "bg-[#0085FC] text-white"
                          : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/70"
                      }`}
                    >
                      Equipo {t}
                    </button>
                  ))}
                </div>
              </div>
              {error ? <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p> : null}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className={`flex-1 ${adminButtonSecondary}`}>
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={isPending || teamFull}
                  onClick={handleAdd}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(0,133,252,0.55)] transition-all duration-200 hover:brightness-105 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #0085FC, #0461C4)" }}
                >
                  {isPending ? "Agregando…" : "Agregar al partido"}
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-[var(--border-subtle)] pt-4">
              {error ? <p className="mb-3 text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p> : null}
              <button type="button" onClick={onClose} className={`w-full ${adminButtonSecondary}`}>
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
