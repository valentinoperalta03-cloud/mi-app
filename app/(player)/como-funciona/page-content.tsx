"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Banknote,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Percent,
  Trophy,
  TrendingUp,
  UserCircle,
} from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const playerSteps = [
  {
    number: 1,
    title: "Creá tu cuenta",
    description:
      "Registrate gratis en menos de 2 minutos. Completá tu perfil y determiná tu nivel de juego.",
    icon: UserCircle,
  },
  {
    number: 2,
    title: "Encontrá tu cancha",
    description:
      "Explorá los clubes disponibles cerca tuyo, elegí la cancha y el horario que más te convenga.",
    icon: MapPin,
  },
  {
    number: 3,
    title: "Pagá tu parte",
    description:
      "Cada jugador paga únicamente su parte del turno (1/4). Pagos seguros a través de Mercado Pago.",
    icon: CreditCard,
  },
  {
    number: 4,
    title: "¡A jugar!",
    description:
      "Unite a partidos existentes o creá el tuyo. Sumá rivales, medí tu nivel y mejorá con cada partido.",
    icon: Trophy,
  },
] as const;

const clubBenefits = [
  {
    title: "Más reservas",
    description: "Tus canchas disponibles las 24hs. Los jugadores reservan sin llamar.",
    icon: TrendingUp,
  },
  {
    title: "Cobros automáticos",
    description:
      "Recibís el dinero directo en tu cuenta de Mercado Pago. Sin intermediarios.",
    icon: Banknote,
  },
  {
    title: "Panel de control",
    description: "Gestioná reservas, canchas y horarios desde tu celular.",
    icon: LayoutDashboard,
  },
  {
    title: "Sin costo fijo",
    description: "Solo pagás el 5% por cada reserva confirmada. Sin suscripción ni costos ocultos.",
    icon: Percent,
  },
] as const;

const clubSteps = [
  {
    title: "Registrá tu club",
    description: "Creás tu cuenta admin y cargás tus canchas con precios y horarios.",
  },
  {
    title: "Conectá Mercado Pago",
    description: "Vinculás tu cuenta MP para recibir los pagos directamente.",
  },
  {
    title: "Listo para recibir reservas",
    description: "Tus clientes ya pueden encontrarte y reservar en Padelibre.",
  },
] as const;

const playerPricing = [
  "Reservas sin cargo de membresía",
  "Solo pagás tu parte del turno",
  "+5% comisión de servicio",
  "Cancelación con reembolso",
];

const clubPricing = [
  "Panel de administración incluido",
  "Cobros automáticos vía MP",
  "Soporte dedicado",
  "Sin contratos",
];

function PadelBallDecoration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 140 140"
      className="absolute -right-9 -top-8 h-36 w-36 opacity-10"
      fill="none"
    >
      <circle cx="70" cy="70" r="62" stroke="white" strokeWidth="10" />
      <path d="M19 54 C46 27, 94 27, 121 54" stroke="white" strokeWidth="8" />
      <path d="M19 86 C46 113, 94 113, 121 86" stroke="white" strokeWidth="8" />
    </svg>
  );
}

export default function ComoFuncionaContent() {
  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-4 pb-24 pt-6">
      <motion.section
        style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
        className="relative overflow-hidden rounded-3xl p-8 text-white"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <PadelBallDecoration />
        <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Padelibre</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight">
          El pádel que te merecés, al alcance de tu celular
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/80">
          Reservá canchas, creá partidos y conectá con jugadores de tu nivel. Todo en un solo lugar.
        </p>
      </motion.section>

      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-3"
      >
        <motion.h2 variants={item} className="text-xl font-bold text-slate-900">
          Para jugadores 🎾
        </motion.h2>
        {playerSteps.map((step) => {
          const Icon = step.icon;
          return (
            <motion.article
              key={step.title}
              variants={item}
              className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0585FC] text-sm font-bold text-white">
                  {step.number}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon size={20} className="text-[#0585FC]" />
                    <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{step.description}</p>
                </div>
              </div>
            </motion.article>
          );
        })}
      </motion.section>

      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-3 rounded-3xl bg-gradient-to-b from-[#0585FC]/5 to-white p-4"
      >
        <motion.h2 variants={item} className="text-xl font-bold text-slate-900">
          Para clubes 🏟️
        </motion.h2>
        <div className="grid grid-cols-2 gap-3">
          {clubBenefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <motion.article
                key={benefit.title}
                variants={item}
                className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm"
              >
                <Icon size={20} className="text-[#0585FC]" />
                <h3 className="mt-2 text-sm font-semibold text-slate-900">{benefit.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{benefit.description}</p>
              </motion.article>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-3"
      >
        <motion.h2 variants={item} className="text-xl font-bold text-slate-900">
          ¿Cómo se integra tu club?
        </motion.h2>
        {clubSteps.map((step, index) => (
          <motion.article
            key={step.title}
            variants={item}
            className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0585FC] text-sm font-bold text-white">
                {index + 1}
              </span>
              <div>
                <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{step.description}</p>
              </div>
            </div>
          </motion.article>
        ))}
      </motion.section>

      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-3"
      >
        <motion.h2 variants={item} className="text-xl font-bold text-slate-900">
          Transparente y justo
        </motion.h2>
        <div className="grid grid-cols-2 gap-3">
          <motion.article variants={item} className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Jugadores</p>
            <p className="mt-1 text-2xl font-bold text-[#0585FC]">Gratis</p>
            <ul className="mt-3 space-y-2">
              {playerPricing.map((feature) => (
                <li key={feature} className="text-sm leading-relaxed text-slate-500">
                  ✓ {feature}
                </li>
              ))}
            </ul>
          </motion.article>

          <motion.article variants={item} className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Clubes</p>
            <p className="mt-1 text-2xl font-bold text-[#0585FC]">5% por reserva</p>
            <p className="mt-1 text-xs text-slate-500">Sin costo fijo mensual</p>
            <ul className="mt-3 space-y-2">
              {clubPricing.map((feature) => (
                <li key={feature} className="text-sm leading-relaxed text-slate-500">
                  ✓ {feature}
                </li>
              ))}
            </ul>
          </motion.article>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm"
      >
        <h2 className="text-xl font-bold text-slate-900">¿Listo para empezar?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Elegí si querés reservar una cancha o sumar tu club y empezar a recibir reservas hoy.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3">
          <Link
            href="/reservas"
            className="inline-flex items-center justify-center rounded-2xl bg-[#0585FC] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0461C4]"
          >
            Reservar una cancha
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl border border-[#0585FC]/30 bg-white px-4 py-3 text-sm font-semibold text-[#0585FC] transition hover:bg-[#0585FC]/5"
          >
            Registrar mi club
          </Link>
        </div>
      </motion.section>
    </main>
  );
}
