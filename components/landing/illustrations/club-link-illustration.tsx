"use client";

import { Link2, MessageCircle, Share2, CheckCircle2 } from "lucide-react";
import Reveal from "../reveal";
import IllustrationFrame from "./illustration-frame";

function InstagramGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

const channels = [
  { label: "WhatsApp", icon: <MessageCircle className="h-3 w-3" /> },
  { label: "Instagram", icon: <InstagramGlyph className="h-3 w-3" /> },
  { label: "Tus redes", icon: <Share2 className="h-3 w-3" /> },
];

function Step({ n, label, children, delay }: { n: number; label: string; children: React.ReactNode; delay: number }) {
  return (
    <Reveal delay={delay} y={8} className="relative flex gap-3">
      <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0085FC] text-[10px] font-bold text-white ring-4 ring-[#F8FBFF]">
        {n}
      </span>
      <div className="min-w-0 flex-1 pb-4">
        <p className="mb-2 text-[11px] font-bold text-[#031733]">{label}</p>
        {children}
      </div>
    </Reveal>
  );
}

/** Flujo de acceso: el club comparte su link, el jugador lo abre, elige turno y reserva. */
export default function ClubLinkIllustration() {
  return (
    <IllustrationFrame tag="Tu link de reservas" accent="lima">
      <div className="relative">
        <span className="absolute bottom-6 left-[11px] top-3 w-0.5 bg-[repeating-linear-gradient(to_bottom,#9CCBFF_0_4px,transparent_4px_8px)]" aria-hidden="true" />

        <Step n={1} label="Compartís tu link" delay={0}>
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-[0_8px_22px_-14px_rgba(4,97,196,0.45)] ring-1 ring-[#DCEBFF]">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-[#0461C4]" />
            <span className="truncate text-[11px] font-semibold text-[#64748B]">
              padelibre.online/<span className="font-extrabold text-[#031733]">tu-club</span>
            </span>
            <span className="ml-auto shrink-0 rounded-md bg-[#CCFF00] px-2 py-0.5 text-[9px] font-bold text-[#1F2900]">Copiar</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {channels.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-[#EAF3FF] px-2 py-0.5 text-[9px] font-bold text-[#0461C4]">
                {c.icon} {c.label}
              </span>
            ))}
          </div>
        </Step>

        <Step n={2} label="Tu jugador abre tu página y elige" delay={0.12}>
          <div className="rounded-xl bg-white p-2.5 ring-1 ring-[#DCEBFF]">
            <div className="mb-2 flex gap-1.5">
              {["Cancha 1", "Cancha 2"].map((c, i) => (
                <span
                  key={c}
                  className={`rounded-md px-2 py-0.5 text-[9px] font-bold ${i === 1 ? "bg-[#0085FC] text-white" : "bg-[#F5F8FF] text-[#64748B]"}`}
                >
                  {c}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {["18:00", "19:30", "21:00"].map((h, i) => (
                <span
                  key={h}
                  className={`rounded-lg py-1.5 text-center text-[10px] font-bold ${
                    i === 1 ? "bg-[#CCFF00] text-[#1F2900] ring-2 ring-[#031733]/10" : "bg-[#F5F8FF] text-[#94A3B8]"
                  }`}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        </Step>

        <Step n={3} label="Reserva, sin escribirte" delay={0.24}>
          <div className="flex items-center gap-2 rounded-xl bg-[#CCFF00] px-3 py-2 text-[#1F2900]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="text-[11px] font-extrabold">Cancha 2 · 19:30 reservada</span>
          </div>
        </Step>
      </div>
      <p className="text-[9px] font-semibold text-[#94A3B8]">Ejemplo ilustrativo. Cada club elige su propio link.</p>
    </IllustrationFrame>
  );
}
