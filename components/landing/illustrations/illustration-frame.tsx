"use client";

import type { ReactNode } from "react";
import { cardShadow } from "../tokens";

/**
 * Panel base para todos los gráficos de landing: malla de degradé azul/lima + textura de
 * líneas de cancha, en vez de la tarjeta blanca plana genérica. Da identidad visual propia
 * sin recurrir a fondos oscuros.
 */
export default function IllustrationFrame({
  children,
  accent = "blue",
  tag,
  className = "",
}: {
  children: ReactNode;
  accent?: "blue" | "lima";
  tag?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative w-full max-w-sm overflow-hidden rounded-[32px] border border-[#E1EEFF] bg-[#F8FBFF] p-6 ${className}`}
      style={{ boxShadow: cardShadow }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl"
        style={{ background: accent === "lima" ? "rgba(204,255,0,0.28)" : "rgba(0,133,252,0.16)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-14 h-48 w-48 rounded-full blur-3xl"
        style={{ background: "rgba(125,211,252,0.35)" }}
      />
      <svg
        viewBox="0 0 200 200"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"
        fill="none"
        stroke="#0461C4"
        strokeWidth={1.4}
        aria-hidden="true"
      >
        <rect x="18" y="14" width="164" height="172" rx="6" />
        <line x1="100" y1="14" x2="100" y2="186" />
        <line x1="18" y1="100" x2="182" y2="100" strokeDasharray="4 5" />
      </svg>

      {tag && (
        <span className="relative mb-4 inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-[#0461C4] shadow-[0_4px_14px_-6px_rgba(4,97,196,0.35)]">
          {tag}
        </span>
      )}

      <div className="relative">{children}</div>
    </div>
  );
}
