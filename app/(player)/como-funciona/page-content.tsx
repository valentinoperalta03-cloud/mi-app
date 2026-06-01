"use client";

import { motion } from "framer-motion";
import { ChevronDown, CircleDollarSign, Search, TrendingUp, Users } from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
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

const faqs = [
  {
    question: "¿Padelibre tiene costo para el club?",
    answer:
      "No. Para clubes no hay costo de alta ni abono mensual. Es 100% gratis para empezar y operar. Ganamos cuando vos ganás.",
  },
  {
    question: "¿Cómo se confirma una reserva?",
    answer:
      "La reserva se confirma cuando se acredita el pago. Eso evita cancelaciones de último momento y te da una agenda más confiable.",
  },
  {
    question: "¿Quién define el precio del turno?",
    answer:
      "El precio lo define cada club. Vos ves ese valor antes de confirmar y pagás tu parte de forma transparente.",
  },
  {
    question: "¿Qué pasa si me falta un jugador?",
    answer:
      "Podés publicar el partido como abierto y la plataforma prioriza jugadores compatibles por nivel para ayudarte a completar el turno.",
  },
] as const;

export default function ComoFuncionaContent() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-7 px-4 pb-24 pt-6">
      <motion.section
        variants={fadeInUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.25 }}
        style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
        className="relative overflow-hidden rounded-3xl border border-[#0585FC]/20 p-7 text-white"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
        <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Padelibre</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight">
          El pádel como siempre quisiste, pero en tu celular.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/85">
          Simplificamos la organización para que vos solo te preocupes por el próximo smash. Sin
          vueltas, sin mensajes interminables de WhatsApp.
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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Soluciones reales para jugar más y organizar menos
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {playerFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm dark:border-slate-800"
              >
                <span className="inline-flex rounded-xl bg-[#0585FC]/10 p-2.5 text-[#0585FC]">
                  <Icon size={20} />
                </span>
                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">{feature.title}</h3>
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
        className="space-y-4 rounded-3xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-slate-800"
      >
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#0585FC]">Te damos una mano</p>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Preguntas frecuentes
          </h2>
        </div>

        <div className="space-y-2">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700"
            >
              <summary className="flex list-none cursor-pointer items-start justify-between gap-3 text-sm font-semibold text-slate-900 dark:text-white">
                <span>{faq.question}</span>
                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <p className="pt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>

        <div className="rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/5 p-4">
          <p className="text-sm font-bold text-slate-900 dark:text-white">¿Sos dueño de un club?</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Hablá con nosotros por WhatsApp y te ayudamos a sumarte a Padelibre.
          </p>
          <div className="mt-4">
            <a
              href="https://wa.me/5493412591953?text=Hola%2C%20quiero%20sumar%20mi%20club%20a%20Padelibre"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe5d]"
            >
              Hablar por WhatsApp
            </a>
          </div>
        </div>
      </motion.section>
    </main>
  );
}
