"use client";

import type { EvolutionPoint } from "@/lib/profile-insights";
import { formatTechnicalLevelDisplay } from "@/lib/technical-score";

type LevelEvolutionChartProps = {
  points: EvolutionPoint[];
};

const STROKE = "#2563eb";
const FILL = "rgba(37, 99, 235, 0.08)";

export function LevelEvolutionChart({ points }: LevelEvolutionChartProps) {
  if (points.length === 0) {
    return (
      <p className="text-center text-sm text-slate-400">
        Cuando actualices tu nivel, verás la evolución aquí.
      </p>
    );
  }

  const w = 340;
  const h = 112;
  const padX = 8;
  const padY = 10;

  const scores = points.map((p) => p.score);
  const minY = Math.min(0, ...scores) - 0.05;
  const maxY = Math.max(7, ...scores) + 0.05;
  const yRange = Math.max(maxY - minY, 0.15);

  const n = points.length;
  const pts = points.map((p, i) => {
    const x = padX + (n === 1 ? (w - padX * 2) / 2 : (i / (n - 1)) * (w - padX * 2));
    const yNorm = (p.score - minY) / yRange;
    const y = h - padY - yNorm * (h - padY * 2);
    return { x, y, score: p.score, category: p.category };
  });

  const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${lineD} L ${pts[pts.length - 1]!.x.toFixed(1)} ${h - padY} L ${pts[0]!.x.toFixed(1)} ${h - padY} Z`;

  const last = pts[pts.length - 1]!;

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mx-auto block w-full max-w-full"
        role="img"
        aria-label="Evolución de nivel"
      >
        <path d={areaD} fill={FILL} />
        <path
          d={lineD}
          fill="none"
          stroke={STROKE}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={last.x} cy={last.y} r={4.5} fill="white" stroke={STROKE} strokeWidth={2} />
      </svg>
      <div className="mt-3 flex items-baseline justify-between px-1 text-xs text-slate-500">
        <span>
          Último:{" "}
          <span className="font-medium text-slate-800">{formatTechnicalLevelDisplay(last.score)}</span>
        </span>
        <span>{n} registro{n === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}
