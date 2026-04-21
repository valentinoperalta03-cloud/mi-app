"use client";

import { motion } from "framer-motion";
import { Trophy, Zap } from "lucide-react";

type ProfileStatsPanelProps = {
  partidosJugados: number;
  victoriasTotales: number;
  nivelActual: string;
  eloRanking: string;
};

export default function ProfileStatsPanel({
  partidosJugados,
  victoriasTotales,
  nivelActual,
  eloRanking,
}: ProfileStatsPanelProps) {
  const items = [
    { label: "Partidos", value: String(partidosJugados), tone: "text-sky-700", icon: Trophy },
    { label: "Victorias", value: String(victoriasTotales), tone: "text-emerald-700", icon: Trophy },
    { label: "Nivel", value: nivelActual || "—", tone: "text-violet-700", icon: Zap },
    { label: "ELO", value: eloRanking, tone: "text-indigo-700", icon: Zap },
  ] as const;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="mt-5 grid grid-cols-2 gap-3"
    >
      {items.map(({ label, value, tone, icon: Icon }) => (
        <motion.article
          key={label}
          whileHover={{ y: -1 }}
          className="rounded-2xl border border-slate-200/80 bg-white p-3.5 text-center shadow-sm"
        >
          <Icon size={16} className={`mx-auto ${tone}`} />
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
        </motion.article>
      ))}
    </motion.section>
  );
}
