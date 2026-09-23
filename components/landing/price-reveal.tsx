"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

const REGISTRO_HREF = "/registro-club";

const benefits = [
  "Canchas y reservas ilimitadas",
  "Torneos y entrenamientos",
  "Panel de finanzas y reportes",
  "Sin comisión de PadeLibre: el 100% de lo que paga el jugador va a tu cuenta de Mercado Pago",
];

/** Precio revelado con un toque, no un bloque bruto: primero genera curiosidad, después convence. */
export default function PriceReveal() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_-30px_rgba(4,97,196,0.4)] ring-2 ring-[#CCFF00]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#CCFF00]/25 blur-2xl" />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="relative flex w-full flex-col items-center gap-3 px-8 pt-8 pb-6 text-center"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#CCFF00] px-3 py-1 text-xs font-bold text-[#1F2900]">
          Un plan simple
        </span>
        <p className="text-2xl font-extrabold leading-[1.2] tracking-tight text-[#031733] sm:text-3xl">
          Cuesta más o menos lo mismo que un turno de cancha.
        </p>
        <p className="max-w-xs text-xs text-[#64748B]">
          El precio de un turno varía según el club; el nuestro es fijo, siempre el mismo.
        </p>
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0461C4]">
          {open ? "Ver menos" : "Ver el precio exacto"}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="relative overflow-hidden"
          >
            <div className="border-t border-[#EAF3FF] px-8 pb-8 pt-6 text-center">
              <p className="text-5xl font-extrabold text-[#031733]">
                $50.000<span className="text-lg font-semibold text-[#64748B]"> ARS / mes</span>
              </p>
              <p className="mt-1 text-sm font-semibold text-[#0461C4]">por club · 15 días de prueba gratis</p>
              <ul className="mx-auto mt-6 flex max-w-xs flex-col gap-2.5 text-left text-sm text-[#475569]">
                {benefits.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0085FC]" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={REGISTRO_HREF}
                className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-[#CCFF00] px-6 py-3.5 text-base font-bold text-[#031733] shadow-lg transition hover:-translate-y-0.5 hover:brightness-95 active:scale-[0.98]"
              >
                Empezar prueba de 15 días
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
