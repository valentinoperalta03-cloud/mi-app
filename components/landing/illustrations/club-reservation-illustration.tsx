import { Fragment } from "react";
import Reveal from "../reveal";
import IllustrationFrame from "./illustration-frame";

/** Vista de administración: grilla multi-cancha, no el listado de un solo turno que ve el jugador. */
const courts = ["Cancha 1", "Cancha 2", "Cancha 3"];
const hours = ["18:00", "19:00", "20:00"];

// 0 = libre, 1 = reservada, 2 = ocupada/bloqueada — una sola celda por estado resaltado, para que el contraste se lea al toque
const grid = [
  [0, 1, 0],
  [2, 0, 0],
  [0, 0, 1],
];

const cellStyle: Record<number, string> = {
  0: "bg-white text-[#94A3B8]",
  1: "bg-[#CCFF00] text-[#1F2900]",
  2: "bg-[#DCEBFF] text-[#0461C4]",
};

export default function ClubReservationIllustration() {
  return (
    <IllustrationFrame tag="Ocupación de hoy · 3 canchas">
      <div className="grid grid-cols-[auto_repeat(3,1fr)] items-center gap-1.5">
        <span />
        {hours.map((h) => (
          <span key={h} className="text-center text-[9px] font-bold text-[#94A3B8]">
            {h}
          </span>
        ))}
        {courts.map((c, ci) => (
          <Fragment key={c}>
            <span className="pr-1 text-[10px] font-bold text-[#031733]">{c}</span>
            {grid[ci].map((state, hi) => (
              <Reveal
                key={`${ci}-${hi}`}
                delay={(ci * 3 + hi) * 0.05}
                y={4}
                className={`flex h-9 items-center justify-center rounded-lg text-[9px] font-bold ${cellStyle[state]}`}
              >
                {state === 1 ? "Res." : state === 2 ? "Ocup." : "Libre"}
              </Reveal>
            ))}
          </Fragment>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4 text-[10px] font-semibold text-[#64748B]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#CCFF00]" /> Reservada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#DCEBFF]" /> Ocupada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white ring-1 ring-[#E1EEFF]" /> Libre
        </span>
      </div>
    </IllustrationFrame>
  );
}
