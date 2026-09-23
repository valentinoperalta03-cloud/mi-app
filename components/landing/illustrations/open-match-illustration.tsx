"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import PadelCourt from "./padel-court";
import IllustrationFrame from "./illustration-frame";

/** 4 posiciones de dobles sobre una cancha real: 3 ocupadas, 1 se completa con "vos". */
const players = [
  { initials: "FR", color: "#0085FC", x: 26, y: 24 },
  { initials: "LM", color: "#0461C4", x: 74, y: 24 },
  { initials: "SG", color: "#5FA8FF", x: 26, y: 76 },
];

export default function OpenMatchIllustration() {
  const reduceMotion = useReducedMotion();

  return (
    <IllustrationFrame accent="lima" tag="Categoría 6ta · Sáb 20:00">
      <div className="relative mx-auto w-full max-w-[260px]">
        <PadelCourt className="w-full" fill="#EAF3FF" line="#BFDBFE" net="#0461C4" />

        {players.map((p) => (
          <div
            key={p.initials}
            className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-md"
            style={{ background: p.color, left: `${p.x}%`, top: `${p.y}%` }}
          >
            {p.initials}
          </div>
        ))}

        <motion.div
          initial={{ opacity: 1 }}
          whileInView={{ opacity: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ delay: reduceMotion ? 0 : 0.6, duration: reduceMotion ? 0 : 0.01 }}
          className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed border-[#0461C4]/50 bg-white"
          style={{ left: "74%", top: "76%" }}
        >
          <span className="text-sm font-bold leading-none text-[#0461C4]">+</span>
        </motion.div>

        <motion.div
          initial={reduceMotion ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ delay: reduceMotion ? 0 : 0.65, duration: 0.4, ease: "backOut" }}
          className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#CCFF00] text-[10px] font-bold text-[#1F2900] shadow-md ring-4 ring-[#CCFF00]/25"
          style={{ left: "74%", top: "76%" }}
        >
          VOS
        </motion.div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-bold text-[#64748B]">
        <span>3/4</span>
        <span className="text-[#CCFF00]">→</span>
        <motion.span
          initial={{ color: "#64748B" }}
          whileInView={{ color: "#0461C4" }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ delay: reduceMotion ? 0 : 0.7, duration: 0.3 }}
        >
          4/4 completo
        </motion.span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ delay: 0.9, duration: 0.4 }}
        className="mt-3 flex items-center gap-2 rounded-2xl bg-[#0085FC] px-3.5 py-2.5 text-xs font-bold text-white"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#CCFF00]">
          <Check className="h-3 w-3 text-[#1F2900]" strokeWidth={3} />
        </span>
        Partido completo · 4/4 jugadores
      </motion.div>
    </IllustrationFrame>
  );
}
