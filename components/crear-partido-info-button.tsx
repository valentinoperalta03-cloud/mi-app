"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info, X } from "lucide-react";

export function CrearPartidoInfoButton() {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setShowInfo(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--text-tertiary)] shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] transition active:scale-95 dark:ring-white/10"
        aria-label="Cómo funciona crear partido"
      >
        <Info size={18} />
      </button>
      <AnimatePresence>
        {showInfo ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Cómo funciona crear partido"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.3)] dark:bg-[var(--bg-card)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold leading-snug text-slate-900 dark:text-white">
                  ¿Cómo funciona?
                </h3>
                <button
                  type="button"
                  onClick={() => setShowInfo(false)}
                  aria-label="Cerrar"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                <p>
                  Tocás un club → llegás a su página con toda la info. Desde ahí podés:
                </p>
                <p>
                  <span className="font-semibold text-slate-900 dark:text-white">🎾 Reservar una cancha</span> —
                  elegís día, horario y cancha, pagás la seña online y la cancha es tuya.
                </p>
                <p>
                  <span className="font-semibold text-slate-900 dark:text-white">🏆 Ver partidos abiertos</span> —
                  uníte a un partido existente o abrí uno nuevo para que otros jugadores se sumen.
                </p>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
