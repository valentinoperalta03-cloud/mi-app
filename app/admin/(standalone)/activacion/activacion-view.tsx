"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import ActivateSubscriptionButton from "@/app/admin/facturacion/activate-subscription-button";

const CHECKLIST = [
  "15 días completamente gratis",
  "Sin comisiones por reservas ni partidos",
  "Cancelá cuando quieras desde Mercado Pago",
  "$50.000 ARS/mes después del período de prueba",
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

export default function ActivacionView({ clubName, clubId }: { clubName: string; clubId: string }) {
  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-y-auto px-4 py-12 text-white"
      style={{
        background:
          "radial-gradient(120% 90% at 50% -10%, rgba(0,133,252,0.28), transparent 55%), linear-gradient(180deg, #031733 0%, #051c40 55%, #072756 100%)",
      }}
    >
      {/* Textura de puntos, muy sutil, para dar profundidad al navy plano */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      {/* Glows decorativos: lima arriba a la derecha, azul abajo a la izquierda */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#CCFF00]/10 blur-3xl"
        animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#0085FC]/20 blur-3xl"
        animate={{ opacity: [0.6, 0.9, 0.6], scale: [1, 1.06, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />

      {/* Mascota de marca: pelota de padel gigante, apenas insinuada detrás de la card */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[6%] top-[12%] select-none text-[10rem] opacity-[0.06] blur-[1px] sm:text-[14rem]"
      >
        🎾
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-center shadow-[0_25px_70px_-20px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-10"
      >
        <motion.div variants={itemVariants} className="flex flex-col items-center">
          <Image
            src="/logo.png"
            alt="PadeLibre"
            width={60}
            height={60}
            className="rounded-2xl shadow-[0_8px_24px_-6px_rgba(0,133,252,0.6)]"
            priority
          />
          <p className="font-admin-mono mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#CCFF00]">
            PadeLibre
          </p>
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="font-admin-display mt-5 text-2xl font-bold tracking-tight text-white sm:text-3xl"
        >
          Bienvenido, {clubName}
        </motion.h1>

        <motion.div variants={itemVariants} className="mt-3 flex justify-center">
          <span className="inline-flex items-center rounded-full border border-[#CCFF00]/30 bg-[#CCFF00]/10 px-4 py-1.5 text-sm font-semibold text-[#CCFF00]">
            Activá tu prueba gratuita de 15 días
          </span>
        </motion.div>

        <motion.p variants={itemVariants} className="mt-6 text-sm leading-relaxed text-slate-300">
          Para comenzar a usar PadeLibre, activá tu suscripción con débito automático en Mercado Pago.
        </motion.p>
        <motion.p variants={itemVariants} className="mt-3 text-sm leading-relaxed text-slate-300">
          No se te cobra nada hasta el día 15. Si no querés continuar, cancelá desde tu cuenta de Mercado
          Pago antes de esa fecha — sin cargos.
        </motion.p>

        <motion.ul variants={itemVariants} className="mt-7 grid gap-2.5 text-left sm:grid-cols-2">
          {CHECKLIST.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#CCFF00]/15">
                <Check size={13} strokeWidth={3} className="text-[#CCFF00]" />
              </span>
              <span className="text-sm text-slate-200">{item}</span>
            </li>
          ))}
        </motion.ul>

        <motion.div variants={itemVariants}>
          <ActivateSubscriptionButton clubId={clubId} label="Activar prueba gratuita de 15 días" />
        </motion.div>

        <motion.p variants={itemVariants} className="mt-6 text-xs text-slate-400">
          ¿Dudas? soporte.padelibre@gmail.com | +54 9 341 374-1000
        </motion.p>
      </motion.div>
    </div>
  );
}
