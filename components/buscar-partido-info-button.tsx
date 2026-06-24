"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

export function BuscarPartidoInfoButton() {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setShowInfo(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--text-tertiary)] shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] transition active:scale-95 dark:ring-white/10"
        aria-label="Cómo funciona buscar partido"
      >
        <Info size={18} />
      </button>
      {showInfo ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.3)] dark:bg-[var(--bg-card)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Cómo buscar partido</h3>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex gap-3">
                <span className="text-xl">🔍</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Partidos abiertos</p>
                  <p className="mt-0.5 leading-relaxed">
                    Son partidos que otros jugadores crearon y necesitan completar los 4 participantes. Podés
                    unirte en segundos.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">🎯</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Nivel ±1</p>
                  <p className="mt-0.5 leading-relaxed">
                    Algunos partidos requieren que tu nivel esté dentro del rango del creador. Si tu nivel no
                    coincide, podés solicitar unirte y los jugadores votan.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">💳</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Pago compartido</p>
                  <p className="mt-0.5 leading-relaxed">
                    Cada jugador paga su parte (1/4 del total) al unirse. La cancha se reserva automáticamente
                    cuando se completan los 4.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">⚡</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Competitivo vs Amistoso</p>
                  <p className="mt-0.5 leading-relaxed">
                    Los partidos competitivos afectan tu ELO. Los amistosos son para jugar sin presión de
                    ranking.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="mt-6 w-full rounded-2xl bg-[#0585FC] py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
