"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy, Users, Volleyball } from "lucide-react";

const STORAGE_KEY = "onboarding_done";

const slides = [
  {
    title: "Reserva tu cancha",
    description:
      "Elegi club, horario y confirma en segundos. Tu proximo partido empieza aca.",
    Icon: Volleyball,
  },
  {
    title: "Encontra tu partido",
    description:
      "Conecta con la comunidad, sumate a partidos abiertos y juga cuando quieras.",
    Icon: Users,
  },
  {
    title: "Medi tu nivel",
    description:
      "Segui tu progreso con ranking, resultados y objetivos para subir tu juego.",
    Icon: Trophy,
  },
] as const;

export default function OnboardingSlides() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      const done = window.localStorage.getItem(STORAGE_KEY) === "true";
      setOpen(!done);
    } catch {
      setOpen(true);
    }
  }, []);

  const isLast = index === slides.length - 1;
  const current = useMemo(() => slides[index], [index]);

  function closeOnboarding() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Silently ignore storage errors.
    }
    setOpen(false);
  }

  function nextSlide() {
    if (isLast) {
      closeOnboarding();
      return;
    }
    setIndex((prev) => Math.min(prev + 1, slides.length - 1));
  }

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex min-h-screen items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />

          <motion.section
            initial={{ opacity: 0, y: 28, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.99 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/45 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.5)]"
            style={{
              background:
                "radial-gradient(120% 120% at 0% 0%, #eff6ff 0%, #dbeafe 38%, #e0f2fe 65%, #f8fafc 100%)",
            }}
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#0585FC]/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-12 bottom-8 h-44 w-44 rounded-full bg-indigo-200/35 blur-3xl" />

            <div className="relative z-10 flex min-h-[72vh] flex-col px-6 pb-6 pt-7">
              <div className="mx-auto mb-6">
                <div className="relative h-14 w-40 overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-sm">
                  <Image src="/logo-marca.png" alt="Logo de Padelibre" fill className="object-contain p-2" />
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={current.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="flex flex-1 flex-col items-center justify-center text-center"
                >
                  <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/75 text-[#0461C4] shadow-[0_8px_20px_-12px_rgba(2,132,199,0.45)] ring-1 ring-[#0585FC]/40">
                    <current.Icon size={36} strokeWidth={2.1} />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900">{current.title}</h2>
                  <p className="mt-4 max-w-xs text-base font-medium leading-relaxed text-slate-600">
                    {current.description}
                  </p>
                </motion.div>
              </AnimatePresence>

              <div className="mb-6 mt-3 flex items-center justify-center gap-2">
                {slides.map((slide, dotIndex) => (
                  <span
                    key={slide.title}
                    className={`h-2 rounded-full transition-all duration-250 ${
                      dotIndex === index ? "w-6 bg-[#0461C4]" : "w-2 bg-slate-300"
                    }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={closeOnboarding}
                  className="rounded-2xl border border-slate-300 bg-transparent px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Saltar
                </button>
                <button
                  type="button"
                  onClick={nextSlide}
                  className="btn-primary-gradient rounded-2xl px-4 py-3 text-sm font-semibold transition hover:brightness-95"
                >
                  {isLast ? "Empezar!" : "Siguiente"}
                </button>
              </div>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
