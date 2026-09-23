import { Trophy, UserPlus, Dumbbell, Users } from "lucide-react";
import Reveal from "../reveal";
import DrawPath from "../draw-path";
import IllustrationFrame from "./illustration-frame";

/** Un nodo central ("Tu club") y 4 hechos de actividad reciente alrededor. Sin capas extra. */
const activity = [
  { icon: Trophy, text: "Nuevo torneo publicado", x: 50, y: 10 },
  { icon: UserPlus, text: "+3 jugadores esta semana", x: 85, y: 50 },
  { icon: Dumbbell, text: "Nuevo entrenamiento", x: 50, y: 90 },
  { icon: Users, text: "Partido abierto activo", x: 15, y: 50 },
];

export default function CommunityIllustration() {
  return (
    <IllustrationFrame accent="lima">
      <div className="relative mx-auto aspect-square w-full max-w-[260px]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          {activity.map((a, i) => (
            <DrawPath key={a.text} d={`M50 50 L${a.x} ${a.y}`} stroke="#DCEBFF" strokeWidth={2} fill="none" delay={i * 0.1} />
          ))}
        </svg>

        <div
          className="absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0085FC] text-center text-[10px] font-bold leading-tight text-white shadow-[0_14px_30px_-14px_rgba(4,97,196,0.55)]"
          style={{ left: "50%", top: "50%" }}
        >
          Tu club
        </div>

        {activity.map((a, i) => (
          <Reveal
            key={a.text}
            delay={0.15 + i * 0.1}
            y={6}
            className="absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center"
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_8px_18px_-10px_rgba(4,97,196,0.4)]">
              <a.icon className="h-4 w-4 text-[#0461C4]" strokeWidth={1.8} />
            </div>
            <span className="text-[9px] font-semibold leading-tight text-[#475569]">{a.text}</span>
          </Reveal>
        ))}
      </div>
    </IllustrationFrame>
  );
}
