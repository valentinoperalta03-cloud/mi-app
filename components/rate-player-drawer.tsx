"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { submitPlayerRating } from "@/app/(player)/perfil/rating-actions";
import type { ActivityPeer } from "@/lib/player-match-history";

const SCALE = [1, 2, 3, 4, 5, 6, 7] as const;

export function RatePlayerDrawer({
  open,
  matchId,
  peers,
  onClose,
}: {
  open: boolean;
  matchId: string;
  peers: ActivityPeer[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [peerId, setPeerId] = useState<string>("");
  const [rating, setRating] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const peerOptions = useMemo(() => peers.filter((p) => p.player_id), [peers]);

  useEffect(() => {
    if (!open) return;
    setMsg(null);
    setRating(null);
    if (peerOptions.length === 1) {
      setPeerId(peerOptions[0].player_id);
    } else {
      setPeerId("");
    }
  }, [open, peerOptions]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  function handleSubmit() {
    if (!peerId || rating == null) {
      setMsg("Elegí jugador y nivel.");
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await submitPlayerRating(matchId, peerId, rating);
      if (!res.ok) {
        setMsg(res.message);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-t-[1.75rem] border border-slate-200/90 bg-slate-50 shadow-[0_-8px_40px_rgba(15,23,42,0.12)] sm:rounded-3xl sm:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
          <h2 id="rate-drawer-title" className="text-base font-semibold text-slate-800">
            Confirmar nivel
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            Cerrar
          </button>
        </header>

        <div className="space-y-5 px-5 py-5">
          <p className="text-sm leading-relaxed text-slate-600">
            Calificá del 1 al 7 el nivel de juego que viste en la cancha. Ayuda a que los partidos
            queden más parejos.
          </p>

          {peerOptions.length > 1 ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Jugador
              </span>
              <select
                value={peerId}
                onChange={(e) => setPeerId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0085FC]/30 focus:ring-2 focus:ring-[#0085FC]/20/60"
              >
                <option value="">Elegí a quién calificás</option>
                {peerOptions.map((p) => (
                  <option key={p.player_id} value={p.player_id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : peerOptions.length === 1 ? (
            <p className="text-sm font-medium text-slate-700">{peerOptions[0].name}</p>
          ) : null}

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nivel (1–7)
            </span>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {SCALE.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={pending}
                  onClick={() => setRating(n)}
                  className={`rounded-2xl border py-2.5 text-sm font-bold tabular-nums transition-all active:scale-[0.97] disabled:opacity-50 ${
                    rating === n
                      ? "border-[#0085FC]/20 bg-[#0085FC]/50 text-white shadow-md shadow-sky-500/25"
                      : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {msg ? (
            <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-3 py-2 text-sm text-rose-800">
              {msg}
            </p>
          ) : null}

          <button
            type="button"
            disabled={pending || !peerId || rating == null}
            onClick={() => handleSubmit()}
            className="w-full rounded-3xl bg-[#0461C4] py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#0085FC]/50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? "Guardando…" : "Guardar calificación"}
          </button>
        </div>
      </div>
    </div>
  );
}
