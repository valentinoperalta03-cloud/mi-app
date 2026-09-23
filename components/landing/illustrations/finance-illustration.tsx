"use client";

import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import IllustrationFrame from "./illustration-frame";

const points = [40, 55, 48, 70, 62, 80, 74];

function areaPath(vals: number[], w: number, h: number) {
  const step = w / (vals.length - 1);
  const coords = vals.map((v, i) => [i * step, h - (v / 100) * h] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  return { line, area: `${line} L${w} ${h} L0 ${h} Z` };
}

export default function FinanceIllustration() {
  const { line, area } = areaPath(points, 220, 64);

  return (
    <IllustrationFrame tag="Resumen del mes">
      <div className="flex items-end justify-between">
        <p className="text-3xl font-extrabold text-[#031733]">
          $ <span className="text-[#94A3B8]">—</span>
        </p>
        <span className="mb-1 flex items-center gap-1 rounded-full bg-[#CCFF00]/30 px-2.5 py-1 text-[10px] font-bold text-[#1F2900]">
          <TrendingUp className="h-3 w-3" /> Cobrado
        </span>
      </div>

      <svg viewBox="0 0 220 64" className="mt-4 h-16 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="financeArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0085FC" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#0085FC" stopOpacity={0} />
          </linearGradient>
        </defs>
        <motion.path
          d={area}
          fill="url(#financeArea)"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke="#0461C4"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
        <circle cx="220" cy={64 - (points[points.length - 1] / 100) * 64} r="4" fill="#CCFF00" stroke="#031733" strokeWidth={1.5} />
      </svg>

      <div className="mt-4 flex items-center justify-between border-t border-[#E1EEFF] pt-4">
        <div>
          <p className="text-sm font-extrabold text-[#031733]">$ —</p>
          <p className="text-[10px] text-[#64748B]">Pendiente de cobro</p>
        </div>
        <div className="h-8 w-px bg-[#E1EEFF]" />
        <div className="text-right">
          <p className="text-sm font-extrabold text-[#031733]">— %</p>
          <p className="text-[10px] text-[#64748B]">Ocupación</p>
        </div>
      </div>
    </IllustrationFrame>
  );
}
