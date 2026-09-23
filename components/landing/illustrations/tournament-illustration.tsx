"use client";

import { Trophy } from "lucide-react";
import Reveal from "../reveal";
import DrawPath from "../draw-path";
import IllustrationFrame from "./illustration-frame";

/** Recorrido lineal, sin ambigüedad: 4 pasos a la misma altura, en orden. */
const steps = [
  { label: "Zonas", detail: "4 equipos" },
  { label: "Clasificás", detail: "Top 2 avanza", lima: true },
  { label: "Cuadro", detail: "Cruces directos" },
  { label: "Final", detail: "¡Ganaste!", lima: true },
];

export default function TournamentIllustration() {
  return (
    <IllustrationFrame accent="lima" className="max-w-xl" tag="Apertura Otoño · Tu recorrido">
      <div className="relative flex items-start justify-between">
        <svg viewBox="0 0 400 4" className="pointer-events-none absolute left-[12%] right-[12%] top-5 h-1 w-[76%]" preserveAspectRatio="none">
          <DrawPath d="M0 2 L400 2" stroke="#BFDBFE" strokeWidth={3} fill="none" strokeLinecap="round" />
        </svg>

        {steps.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.12} y={10} className="relative z-10 flex flex-1 flex-col items-center gap-2 text-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold shadow-[0_10px_24px_-12px_rgba(4,97,196,0.5)] ${
                s.lima ? "bg-[#CCFF00] text-[#1F2900]" : "bg-[#0085FC] text-white"
              }`}
            >
              {i === steps.length - 1 ? <Trophy className="h-4 w-4" /> : i + 1}
            </div>
            <div>
              <p className="text-[11px] font-bold leading-tight text-[#0F172A]">{s.label}</p>
              <p className="text-[9px] leading-tight text-[#64748B]">{s.detail}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </IllustrationFrame>
  );
}
