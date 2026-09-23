import { Check, Sparkles } from "lucide-react";
import Reveal from "../reveal";
import IllustrationFrame from "./illustration-frame";

/**
 * Una sola idea: vos cargás, PadeLibre arma el resto. Checklist vertical (no un stepper
 * circular como el del jugador) para diferenciar la experiencia de gestión de la de juego.
 */
const steps = [
  { label: "Categorías y anotados", by: "vos" },
  { label: "Zonas del torneo", by: "auto" },
  { label: "Cuadro de cruces", by: "auto" },
  { label: "Resultados", by: "vos" },
];

export default function ClubTournamentIllustration() {
  return (
    <IllustrationFrame tag="Apertura Otoño · Organizando">
      <div className="flex flex-col gap-2">
        {steps.map((s, i) => {
          const auto = s.by === "auto";
          return (
            <Reveal
              key={s.label}
              delay={i * 0.1}
              y={8}
              className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-[0_8px_20px_-16px_rgba(4,97,196,0.4)]"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EAF3FF] text-[10px] font-bold text-[#0461C4]">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <p className="text-[12px] font-bold text-[#0F172A]">{s.label}</p>
              </div>
              <span
                className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  auto ? "bg-[#CCFF00] text-[#1F2900]" : "bg-[#F1F2F6] text-[#8B93A3]"
                }`}
              >
                {auto && <Sparkles className="h-3 w-3" />}
                {auto ? "Automático" : "Vos cargás"}
              </span>
            </Reveal>
          );
        })}
      </div>
    </IllustrationFrame>
  );
}
