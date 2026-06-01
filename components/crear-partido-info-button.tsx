"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

export function CrearPartidoInfoButton() {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setShowInfo(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--text-tertiary)] shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] transition active:scale-95 dark:ring-white/10"
        aria-label="Cómo crear un partido"
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
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cómo crear un partido</h3>
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
                <span className="text-xl">🏟️</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Elegí club y horario</p>
                  <p className="mt-0.5 leading-relaxed">
                    Seleccioná el club, la cancha y el horario disponible. El sistema muestra solo los turnos
                    libres en tiempo real.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">💳</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Pago dividido automático</p>
                  <p className="mt-0.5 leading-relaxed">
                    Cada jugador paga su 1/4 al unirse. Vos pagás tu parte al crear. La cancha se reserva solo
                    cuando los 4 pagaron.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">👥</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Invitá amigos</p>
                  <p className="mt-0.5 leading-relaxed">
                    Podés invitar hasta 3 amigos directamente. También podés publicar el partido como abierto
                    para que otros jugadores se unan.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">⚡</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Competitivo vs Amistoso</p>
                  <p className="mt-0.5 leading-relaxed">
                    Competitivo actualiza el ELO de todos al cargar el resultado. Amistoso es para jugar sin
                    presión de ranking.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">🎯</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Restricción de nivel</p>
                  <p className="mt-0.5 leading-relaxed">
                    Con &quot;Mi nivel ±1&quot; activado, solo jugadores de tu rango pueden unirse directamente.
                    El resto puede solicitar y vos decidís.
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
