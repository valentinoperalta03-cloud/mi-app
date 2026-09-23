import { Activity, Dumbbell, Target } from "lucide-react";
import Reveal from "../reveal";
import IllustrationFrame from "./illustration-frame";

/** Lista simple: día, hora, cupos. Se entiende en una mirada, sin decoración de más. */
const activities = [
  { icon: Target, label: "Técnica", day: "Lunes 19:00", spots: "2 cupos libres", full: false },
  { icon: Dumbbell, label: "Físico", day: "Miércoles 20:00", spots: "1 cupo libre", full: false },
  { icon: Activity, label: "Táctica", day: "Viernes 18:30", spots: "Completo", full: true },
];

export default function TrainingIllustration() {
  return (
    <IllustrationFrame tag="Entrenamientos de tu club">
      <div className="flex flex-col gap-2.5">
        {activities.map((a, i) => (
          <Reveal
            key={a.label}
            delay={i * 0.1}
            y={10}
            className={`flex items-center gap-3 rounded-xl p-3 ${
              a.full ? "bg-white/70" : "bg-white ring-1 ring-[#CCFF00]/70"
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF3FF]">
              <a.icon className="h-4 w-4 text-[#0461C4]" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#0F172A]">{a.label}</p>
              <p className="text-[10px] text-[#64748B]">{a.day}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                a.full ? "bg-[#F1F2F6] text-[#8B93A3]" : "bg-[#CCFF00] text-[#1F2900]"
              }`}
            >
              {a.spots}
            </span>
          </Reveal>
        ))}
      </div>
    </IllustrationFrame>
  );
}
