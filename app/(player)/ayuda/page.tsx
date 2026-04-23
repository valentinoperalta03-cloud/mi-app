"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronDown, CreditCard, Rocket, Settings2, Trophy, Users } from "lucide-react";

type HelpCategory = {
  id: string;
  title: string;
  icon: typeof Settings2;
  faqs: { question: string; answer: string }[];
};

const categories: HelpCategory[] = [
  {
    id: "app-config",
    title: "App y configuración",
    icon: Settings2,
    faqs: [
      {
        question: "¿Cómo actualizo mi perfil y mi foto?",
        answer:
          "Entrá a Perfil > Editar, actualizá tus datos y guardá. Tu foto se refleja automáticamente en tus partidos y comunidad.",
      },
      {
        question: "¿Puedo cambiar las notificaciones?",
        answer:
          "Sí. Desde Ajustes podés activar o desactivar alertas para reservas, invitaciones, mensajes y resultados.",
      },
      {
        question: "¿Cómo cambio entre modo claro y oscuro?",
        answer:
          "Usá el selector de tema en la app. Padelibre recuerda tu preferencia para mantener la experiencia consistente.",
      },
    ],
  },
  {
    id: "reservas-pagos",
    title: "Reserva y pagos",
    icon: CreditCard,
    faqs: [
      {
        question: "¿Cuándo queda confirmada una reserva?",
        answer:
          "La reserva se confirma cuando el pago se acredita correctamente. Si el pago queda pendiente, la reserva también queda pendiente.",
      },
      {
        question: "¿Qué pasa si mi pago falla?",
        answer:
          "Si el pago es rechazado o cancelado, la reserva no se confirma y el horario vuelve a quedar disponible.",
      },
      {
        question: "¿Dónde veo el estado de mi pago?",
        answer:
          "En la sección Reservas podés ver cada turno con su estado actualizado: confirmado, pendiente o cancelado.",
      },
    ],
  },
  {
    id: "partidos-comunidad",
    title: "Partidos abiertos y comunidad",
    icon: Users,
    faqs: [
      {
        question: "¿Cómo me sumo a un partido abierto?",
        answer:
          "Entrá en Buscar partido, elegí uno compatible con tu nivel y enviá la solicitud para unirte.",
      },
      {
        question: "¿Dónde veo mensajes y actividad?",
        answer:
          "En Comunidad podés seguir publicaciones, comentarios y mensajes directos con otros jugadores.",
      },
      {
        question: "¿Puedo crear un partido privado?",
        answer:
          "Sí. Al crear partido podés ajustar visibilidad para invitar solo a quienes vos elijas.",
      },
    ],
  },
  {
    id: "nivel-resultados",
    title: "Nivel y resultados",
    icon: Trophy,
    faqs: [
      {
        question: "¿Cómo se actualiza mi nivel?",
        answer:
          "Tu nivel evoluciona con la actividad y resultados confirmados de partidos competitivos dentro de la plataforma.",
      },
      {
        question: "¿Quién puede cargar resultados?",
        answer:
          "Participantes y organizadores autorizados según el tipo de partido y el estado actual del encuentro.",
      },
      {
        question: "¿Qué pasa si hay conflicto en el resultado?",
        answer:
          "El partido puede pasar a estado impugnado y no impacta nivel hasta que se resuelva correctamente.",
      },
    ],
  },
  {
    id: "aprende-compite",
    title: "Aprende y compite",
    icon: Rocket,
    faqs: [
      {
        question: "¿Cómo mejoro mi constancia de juego?",
        answer:
          "Combiná reservas semanales con partidos abiertos para sostener ritmo y mejorar toma de decisiones.",
      },
      {
        question: "¿Qué me conviene para empezar a competir?",
        answer:
          "Empezá por partidos de tu rango, registrá resultados y analizá tu progreso en Perfil > Actividad.",
      },
      {
        question: "¿Padelibre me recomienda rivales?",
        answer:
          "Sí, la app prioriza cruces y propuestas acordes a tu nivel y disponibilidad para que juegues mejor.",
      },
    ],
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32 } },
};

export default function AyudaPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-8 px-4 pb-24 pt-6 md:px-6">
      <header className="space-y-3">
        <p className="text-sm font-medium text-[#0585FC]">Centro de ayuda</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
          Cómo funciona Padelibre
        </h1>
        <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400 md:text-base">
          Todo lo que necesitás saber para dominar la cancha.
        </p>
      </header>

      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <motion.article
              key={category.id}
              variants={item}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-blue-500/30 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-400/30"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
                <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <Icon size={18} />
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {category.title}
                </h2>
              </div>

              <div className="space-y-2 p-4">
                {category.faqs.map((faq) => (
                  <details
                    key={faq.question}
                    className="group rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                      <span>{faq.question}</span>
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
                    </summary>
                    <p className="pt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </motion.article>
          );
        })}
      </motion.section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          ¿Necesitás más ayuda?
        </h3>
        <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Si no encontraste la respuesta en estas guías, escribinos y te damos una mano.
        </p>
        <div className="mt-4">
          <Link
            href="/comunidad/mensajes"
            className="inline-flex items-center justify-center rounded-2xl bg-[#0585FC] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0461C4] dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            Hablar con soporte
          </Link>
        </div>
      </section>
    </main>
  );
}
