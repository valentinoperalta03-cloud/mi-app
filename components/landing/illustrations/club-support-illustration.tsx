"use client";

import { Store, UserRound } from "lucide-react";
import Reveal from "../reveal";
import IllustrationFrame from "./illustration-frame";

const team = ["#0085FC", "#7DD3FC", "#0461C4"];

/** Cercanía humana: una conversación club ↔ referente, con el equipo PadeLibre detrás. */
export default function ClubSupportIllustration() {
  return (
    <IllustrationFrame tag="Tu persona de referencia" accent="lima">
      <div className="flex flex-col gap-3">
        <Reveal delay={0} y={8} className="flex items-end gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#CCFF00] text-[#1F2900] ring-2 ring-white">
            <UserRound className="h-4 w-4" />
          </span>
          <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-white px-3 py-2 shadow-[0_8px_22px_-14px_rgba(4,97,196,0.45)]">
            <p className="text-[9px] font-bold text-[#4a5a00]">Referente comercial</p>
            <p className="text-[11px] font-semibold leading-snug text-[#031733]">
              ¡Hola! Te acompaño a dejar listo tu club. ¿Arrancamos por las canchas?
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.15} y={8} className="flex items-end justify-end gap-2">
          <div className="max-w-[75%] rounded-2xl rounded-br-md bg-[#0085FC] px-3 py-2 text-white">
            <p className="text-[9px] font-bold text-white/75">Tu club</p>
            <p className="text-[11px] font-semibold leading-snug">Dale, tenemos 4 canchas.</p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF3FF] text-[#0461C4] ring-2 ring-white">
            <Store className="h-4 w-4" />
          </span>
        </Reveal>

        <Reveal delay={0.3} y={8} className="mt-1 flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2.5 ring-1 ring-[#DCEBFF]">
          <div className="flex -space-x-2">
            {team.map((c) => (
              <span key={c} className="flex h-7 w-7 items-center justify-center rounded-full text-white ring-2 ring-white" style={{ background: c }}>
                <UserRound className="h-3.5 w-3.5" />
              </span>
            ))}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold text-[#031733]">Equipo PadeLibre</p>
            <p className="text-[10px] text-[#64748B]">Detrás de tu referente, para lo que necesites</p>
          </div>
        </Reveal>
      </div>
    </IllustrationFrame>
  );
}
