import { Plus } from "lucide-react";
import Reveal from "../reveal";
import IllustrationFrame from "./illustration-frame";

/** Una sola idea: publicás una actividad, la app te muestra los cupos. Chip numérico, no un aro ambiguo. */
const activities = [
  { label: "Técnica", day: "Lunes 19:00", filled: 7, total: 8 },
  { label: "Físico", day: "Miércoles 20:00", filled: 5, total: 8 },
  { label: "Táctica", day: "Viernes 18:30", filled: 8, total: 8 },
];

export default function ClubTrainingIllustration() {
  return (
    <IllustrationFrame tag="Actividades publicadas">
      <span className="mb-4 inline-flex items-center gap-1 rounded-full bg-[#0085FC] px-2.5 py-1 text-[10px] font-bold text-white">
        <Plus className="h-3 w-3" /> Nueva actividad
      </span>

      <div className="flex flex-col gap-2.5">
        {activities.map((a, i) => {
          const full = a.filled === a.total;
          return (
            <Reveal
              key={a.label}
              delay={i * 0.08}
              y={8}
              className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-[0_8px_20px_-16px_rgba(4,97,196,0.4)]"
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] font-bold text-[#0F172A]">{a.label}</p>
                <p className="text-[10px] text-[#64748B]">{a.day}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  full ? "bg-[#F1F2F6] text-[#8B93A3]" : "bg-[#CCFF00] text-[#1F2900]"
                }`}
              >
                {full ? "Completo" : `${a.filled}/${a.total} cupos`}
              </span>
            </Reveal>
          );
        })}
      </div>
    </IllustrationFrame>
  );
}
