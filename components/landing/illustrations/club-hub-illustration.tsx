import { CalendarCheck, Trophy, Dumbbell, Users, Wallet, Smartphone } from "lucide-react";
import DrawPath from "../draw-path";

/**
 * Organigrama, no hub circular: el panel del club arriba, 5 módulos en fila debajo,
 * y la app de jugadores como sistema externo conectado por una línea distinta.
 * Deliberadamente distinto del diagrama de red de "comunidad" (lado jugador).
 */
const modules = [
  { icon: Wallet, label: "Finanzas", x: 8 },
  { icon: CalendarCheck, label: "Reservas", x: 29 },
  { icon: Trophy, label: "Torneos", x: 50 },
  { icon: Dumbbell, label: "Entrenamientos", x: 71 },
  { icon: Users, label: "Jugadores", x: 92 },
];

export default function ClubHubIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-[380px] rounded-[32px] bg-[#F8FBFF] px-6 py-8">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {modules.map((m, i) => (
          <DrawPath key={m.label} d={`M50 20 L${m.x} 46`} stroke="#BFDBFE" strokeWidth={1.3} fill="none" delay={i * 0.08} />
        ))}
        <DrawPath d="M50 46 L50 74" stroke="#BFDBFE" strokeWidth={1.3} strokeDasharray="3 3" fill="none" delay={0.5} />
      </svg>

      <div className="relative flex flex-col items-center gap-1.5">
        <div className="flex h-14 w-32 items-center justify-center rounded-2xl bg-[#0085FC] text-center text-xs font-bold text-white shadow-[0_14px_34px_-16px_rgba(4,97,196,0.6)]">
          Panel del club
        </div>
      </div>

      <div className="relative mt-10 grid grid-cols-5 gap-1.5">
        {modules.map((m) => (
          <div key={m.label} className="flex flex-col items-center gap-1.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCEBFF] bg-white shadow-[0_10px_22px_-14px_rgba(4,97,196,0.35)]">
              <m.icon className="h-4 w-4 text-[#0461C4]" strokeWidth={1.8} />
            </div>
            <span className="text-center text-[8.5px] font-bold leading-tight text-[#0F172A]">{m.label}</span>
          </div>
        ))}
      </div>

      <div className="relative mt-9 flex flex-col items-center gap-1.5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#CCFF00] shadow-[0_14px_30px_-14px_rgba(204,255,0,0.7)]">
          <Smartphone className="h-5 w-5 text-[#1F2900]" strokeWidth={1.8} />
        </div>
        <span className="text-[10px] font-bold text-[#0F172A]">App de jugadores</span>
        <span className="text-[8.5px] font-semibold text-[#94A3B8]">Sistema conectado</span>
      </div>
    </div>
  );
}
