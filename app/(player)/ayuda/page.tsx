"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Lock,
  Megaphone,
  Search,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

const playerFeatures = [
  {
    title: "Encontrá y Reservá",
    description:
      "No más llamar a 5 clubes. Mirá la disponibilidad real de toda tu zona en segundos.",
    icon: Search,
  },
  {
    title: "Pagá solo tu parte",
    description:
      "Chau a cobrarle a tus amigos. Cada uno paga su 1/4 del turno por Mercado Pago al sumarse. El turno se reserva solo cuando se completa.",
    icon: CircleDollarSign,
  },
  {
    title: "Subí de nivel",
    description:
      "Sistema de ranking dinámico. Medí tu progreso, cargá tus resultados y encontrá partidos de tu misma categoría.",
    icon: TrendingUp,
  },
  {
    title: "Comunidad Activa",
    description:
      "¿Te falta uno? Publicá tu partido y dejá que el sistema encuentre al jugador ideal por vos según su nivel.",
    icon: Users,
  },
] as const;

const clubFeatures = [
  {
    title: "Métricas en tiempo real",
    description:
      "Panel de control con ingresos, ocupación y horarios más rentables para tomar mejores decisiones.",
    icon: BarChart3,
  },
  {
    title: "Eliminá los huecos",
    description:
      "Nuestro sistema de Partidos Abiertos ayuda a completar turnos en horarios muertos automáticamente.",
    icon: Zap,
  },
  {
    title: "Gestión 24/7",
    description:
      "Recibí reservas mientras el club está cerrado. Tu agenda se actualiza sola sin que tengas que atender el teléfono.",
    icon: Clock3,
  },
  {
    title: "Visibilidad Total",
    description:
      "Ponemos tu club frente a miles de jugadores de la zona que hoy no te conocen.",
    icon: Megaphone,
  },
  {
    title: "Cero deudas",
    description:
      "Olvidate de los no-show. Las reservas se confirman solo con el pago realizado. El dinero va directo a tu cuenta de Mercado Pago.",
    icon: Lock,
  },
] as const;

const faqs = [
  {
    question: "¿Padelibre tiene costo para el club?",
    answer:
      "No. Para clubes no hay costo de alta ni abono mensual. Es 100% gratis para empezar y operar. Nuestro objetivo es crecer junto a vos.",
  },
  {
    question: "¿Cómo se confirma una reserva?",
    answer:
      "La reserva se confirma cuando se completa el pago del turno según las reglas del partido. Esto evita cancelaciones de último momento y mejora la ocupación real.",
  },
  {
    question: "¿Quién define el precio del turno?",
    answer:
      "El precio lo define cada club. Los jugadores ven ese valor con claridad antes de confirmar y pagan su parte correspondiente al sumarse.",
  },
  {
    question: "¿Qué pasa si me falta un jugador?",
    answer:
      "Podés publicar el partido como abierto. Padelibre prioriza sugerencias por nivel para ayudarte a completar el turno de forma más rápida y equilibrada.",
  },
];

export default function AyudaPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-7 px-4 pb-24 pt-6 md:space-y-10 md:px-6">
      <motion.section
        variants={fadeInUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.25 }}
        className="relative overflow-hidden rounded-3xl border border-[#0585FC]/20 bg-gradient-to-br from-[#0585FC] to-[#0461C4] p-7 text-white md:p-10"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Padelibre</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight md:text-5xl">
          El pádel que siempre quisiste, pero en tu celular.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/85 md:text-base">
          Simplificamos la organización para que vos solo te preocupes por el próximo smash. Sin
          vueltas y sin mensajes interminables de WhatsApp.
        </p>
      </motion.section>

      <motion.section
        variants={fadeInUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#0585FC]">Para jugadores</p>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">
            Soluciones reales para jugar más y organizar menos
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {playerFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="inline-flex rounded-xl bg-[#0585FC]/10 p-2.5 text-[#0585FC]">
                  <Icon size={20} />
                </span>
                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        variants={fadeInUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="space-y-4 rounded-3xl border border-[#0585FC]/15 bg-gradient-to-b from-[#0585FC]/5 to-transparent p-5 md:p-7"
      >
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#0585FC]">Para clubes</p>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">
            Tu club en piloto automático. Sin costos fijos.
          </h2>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Unirse a Padelibre no tiene costo mensual ni de alta. Ganamos solo si vos ganás.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {clubFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex shrink-0 rounded-xl bg-[#0585FC]/10 p-2.5 text-[#0585FC]">
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {feature.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        variants={fadeInUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#0585FC]">Transparencia y costos</p>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">
            Un modelo justo para todos
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <article className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#0585FC]">Clubes</p>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">$0 costo fijo</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Gestión, visibilidad y herramientas profesionales gratis.
            </p>
          </article>
          <article className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#0585FC]">Jugadores</p>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Pagás tu parte</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Cada jugador paga la parte correspondiente de su turno (el club define el precio) y
              una pequeña comisión que incluye los impuestos.
            </p>
          </article>
        </div>
      </motion.section>

      <motion.section
        variants={fadeInUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="space-y-4 rounded-3xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#0585FC]">Te damos una mano</p>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">
            Preguntas frecuentes
          </h2>
        </div>

        <div className="space-y-2">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40"
            >
              <summary className="flex list-none cursor-pointer items-start justify-between gap-3 text-sm font-semibold text-slate-900 dark:text-white">
                <span>{faq.question}</span>
                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <p className="pt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>

        <div className="rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/5 p-4">
          <div className="flex items-start gap-2">
            <Sparkles size={18} className="mt-0.5 text-[#0585FC]" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                ¿Sos dueño de un club y querés ser parte?
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Escribinos y te mostramos cómo activar tu club, configurar precios y empezar a
                recibir reservas.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Link
              href="mailto:soporte.padelibre@gmail.com?subject=Quiero%20sumar%20mi%20club%20a%20Padelibre&body=Hola%20equipo%20de%20Padelibre,%0A%0ASoy%20due%C3%B1o%20de%20un%20club%20y%20quiero%20m%C3%A1s%20informaci%C3%B3n%20para%20sumarme.%0A%0AGracias."
              className="inline-flex items-center justify-center rounded-2xl bg-[#0585FC] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0461C4]"
            >
              Contactar a soporte
            </Link>
          </div>
        </div>
      </motion.section>
    </main>
  );
}
