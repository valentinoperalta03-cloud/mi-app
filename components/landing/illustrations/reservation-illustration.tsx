"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import PadelCourt from "./padel-court";
import IllustrationFrame from "./illustration-frame";

/** Una fila = una cancha real de pádel + su estado. Lectura inmediata de disponibilidad. */
const courts = [
  { name: "Cancha 1", time: "18:00", state: "ocupada" as const },
  { name: "Cancha 2", time: "20:00", state: "reservada" as const },
  { name: "Cancha 3", time: "19:00", state: "libre" as const },
];

const theme: Record<(typeof courts)[number]["state"], { fill: string; line: string; net: string; label: string; chip: string }> = {
  libre: { fill: "#F5FAFF", line: "#BFDBFE", net: "#7DAFEA", label: "Libre", chip: "bg-[#EAF3FF] text-[#0461C4]" },
  ocupada: { fill: "#F1F2F6", line: "#D6DBE4", net: "#AEB6C4", label: "Ocupada", chip: "bg-[#F1F2F6] text-[#8B93A3]" },
  reservada: { fill: "#FCFFE8", line: "#E4F98A", net: "#4a5a00", label: "Reservada", chip: "bg-[#CCFF00] text-[#1F2900]" },
};

export default function ReservationIllustration() {
  return (
    <IllustrationFrame tag="Club Norte Pádel · Hoy">
      <div className="flex flex-col gap-2.5">
        {courts.map((c, i) => {
          const t = theme[c.state];
          return (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className={`flex items-center gap-3 rounded-xl p-2 ${
                c.state === "reservada" ? "ring-2 ring-[#CCFF00] bg-[#FCFFE8]" : "bg-white"
              }`}
            >
              <PadelCourt className="h-9 w-16 shrink-0" fill={t.fill} line={t.line} net={t.net} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold text-[#0F172A]">{c.name}</p>
                <p className="text-[10px] text-[#64748B]">{c.time} hs</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${t.chip}`}>{t.label}</span>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="mt-4 flex items-center gap-2 rounded-2xl bg-[#0085FC] px-3.5 py-2.5 text-xs font-bold text-white"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#CCFF00]">
          <Check className="h-3 w-3 text-[#1F2900]" strokeWidth={3} />
        </span>
        Cancha 2 reservada · 20:00
      </motion.div>
    </IllustrationFrame>
  );
}
