"use client";

import { ArrowDown, ArrowRight, CalendarCheck, CheckCircle2, CreditCard, LayoutDashboard, Store, UserRound } from "lucide-react";
import Reveal from "../reveal";
import { cardShadow } from "../tokens";

type Lane = {
  who: string;
  icon: React.ReactNode;
  tone: "blue" | "lima";
  steps: { icon: React.ReactNode; text: string }[];
};

const lanes: Lane[] = [
  {
    who: "Jugador",
    icon: <UserRound className="h-3.5 w-3.5" />,
    tone: "blue",
    steps: [
      { icon: <CalendarCheck className="h-4 w-4" />, text: "Reserva cancha y horario" },
      { icon: <CreditCard className="h-4 w-4" />, text: "Paga online con Mercado Pago" },
    ],
  },
  {
    who: "Tu club",
    icon: <Store className="h-3.5 w-3.5" />,
    tone: "lima",
    steps: [
      { icon: <CheckCircle2 className="h-4 w-4" />, text: "La reserva queda confirmada" },
      { icon: <LayoutDashboard className="h-4 w-4" />, text: "La ves en tu panel con su pago" },
    ],
  },
];

function LaneCard({ lane, delay }: { lane: Lane; delay: number }) {
  const lima = lane.tone === "lima";
  return (
    <Reveal
      delay={delay}
      y={10}
      className={`flex-1 rounded-3xl p-4 ${lima ? "bg-[#F6FFD6] ring-2 ring-[#CCFF00]" : "bg-white ring-1 ring-[#DCEBFF]"}`}
      style={{ boxShadow: cardShadow }}
    >
      <span
        className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
          lima ? "bg-[#CCFF00] text-[#1F2900]" : "bg-[#0085FC] text-white"
        }`}
      >
        {lane.icon} {lane.who}
      </span>
      <ol className="flex flex-col gap-2">
        {lane.steps.map((s) => (
          <li key={s.text} className="flex items-center gap-2.5 rounded-xl bg-white/85 px-3 py-2.5">
            <span className={`shrink-0 ${lima ? "text-[#4a5a00]" : "text-[#0085FC]"}`}>{s.icon}</span>
            <span className="text-xs font-bold text-[#031733]">{s.text}</span>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}

/** Traspaso jugador → club: dos carriles diferenciados para dejar claro quién hace qué. */
export default function OnlinePaymentFlowIllustration() {
  return (
    <div className="flex w-full flex-col items-stretch gap-3 md:flex-row md:items-center">
      <LaneCard lane={lanes[0]} delay={0} />
      <Reveal delay={0.15} y={0} className="flex shrink-0 flex-col items-center gap-1 self-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#CCFF00] text-[#1F2900] shadow-[0_10px_24px_-10px_rgba(122,153,0,0.7)]">
          <ArrowDown className="h-5 w-5 md:hidden" />
          <ArrowRight className="hidden h-5 w-5 md:block" />
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wide text-[#64748B]">Pago aprobado</span>
      </Reveal>
      <LaneCard lane={lanes[1]} delay={0.3} />
    </div>
  );
}
