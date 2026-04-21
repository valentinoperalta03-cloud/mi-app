"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MessageCircle, Sparkles, Users } from "lucide-react";

const sections = [
  {
    title: "Mis Amigos",
    description: "Buscá y agregá nuevos compañeros",
    href: "/comunidad/buscar",
    cta: "Buscar jugadores",
    Icon: Users,
    iconClass:
      "bg-gradient-to-br from-[#0585FC] via-[#0585FC] to-indigo-500 text-white shadow-inner shadow-white/20",
  },
  {
    title: "Para ti",
    description: "Publicaciones y resultados de la comunidad",
    href: "/comunidad/feed",
    cta: "Ver feed",
    Icon: Sparkles,
    iconClass:
      "bg-gradient-to-br from-indigo-400 via-[#0585FC] to-cyan-400 text-white shadow-inner shadow-white/20",
  },
  {
    title: "Mensajes",
    description: "Chat directo con tus compañeros",
    href: "/comunidad/mensajes",
    cta: "Abrir mensajes",
    Icon: MessageCircle,
    iconClass:
      "bg-gradient-to-br from-cyan-400 via-[#0585FC] to-[#0461C4] text-white shadow-inner shadow-white/20",
  },
] as const;

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function ComunidadAnimatedHub() {
  return (
    <motion.div
      className="flex flex-col gap-5"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {sections.map(({ title, description, href, cta, Icon, iconClass }) => (
        <motion.article
          key={href}
          variants={item}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.99 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="relative overflow-hidden rounded-[2.5rem] border border-slate-200/70 bg-white p-6 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.18)]"
        >
          <div className="relative z-[1] max-w-[70%] space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
            <p className="text-sm leading-relaxed text-slate-500">{description}</p>
            <Link
              href={href}
              className="inline-flex rounded-[2rem] bg-[#0461C4] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-600/20 transition hover:bg-[#0585FC]/50"
            >
              {cta}
            </Link>
          </div>
          <div
            className={`pointer-events-none absolute -bottom-3 -right-2 flex h-28 w-28 items-center justify-center rounded-[2rem] ${iconClass} opacity-[0.92]`}
            aria-hidden
          >
            <Icon className="h-14 w-14" strokeWidth={1.35} />
          </div>
        </motion.article>
      ))}
    </motion.div>
  );
}
