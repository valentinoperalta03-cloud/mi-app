"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarCheck, Users, Trophy, Dumbbell, Sparkles } from "lucide-react";
import LandingNav from "@/components/landing/landing-nav";
import LandingFooter from "@/components/landing/landing-footer";
import Reveal from "@/components/landing/reveal";
import { heroGradient, bandGradient, softSectionBg, limaSoftBg } from "@/components/landing/tokens";
import CourtLines from "@/components/landing/illustrations/court-lines";
import ReservationIllustration from "@/components/landing/illustrations/reservation-illustration";
import OpenMatchIllustration from "@/components/landing/illustrations/open-match-illustration";
import TournamentIllustration from "@/components/landing/illustrations/tournament-illustration";
import TrainingIllustration from "@/components/landing/illustrations/training-illustration";
import CommunityIllustration from "@/components/landing/illustrations/community-illustration";

const APP_STORE_URL = "https://apps.apple.com/us/app/padelibre/id6769852990";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.padelibre.app";

function DownloadBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-3 sm:flex-row ${className}`}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-2xl bg-[#031733] px-5 py-3 shadow-lg transition hover:-translate-y-0.5 hover:brightness-125 active:scale-[0.98]"
      >
        <Image src="/app-store.png" alt="App Store" width={28} height={28} className="shrink-0" />
        <div className="text-left">
          <p className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Disponible en</p>
          <p className="text-base font-bold leading-tight text-white">App Store</p>
        </div>
      </a>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-2xl bg-[#031733] px-5 py-3 shadow-lg transition hover:-translate-y-0.5 hover:brightness-125 active:scale-[0.98]"
      >
        <Image src="/google-play.png" alt="Google Play" width={28} height={28} className="shrink-0" />
        <div className="text-left">
          <p className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Disponible en</p>
          <p className="text-base font-bold leading-tight text-white">Google Play</p>
        </div>
      </a>
    </div>
  );
}

const sections = [
  {
    key: "reservas",
    icon: CalendarCheck,
    eyebrow: "01 · Encontrá una cancha",
    title: "Reservá tu cancha en segundos.",
    text: "Ves disponibilidad en tiempo real, el precio y la cancha del club. Elegís horario y confirmás desde la app, sin llamar a nadie.",
    Illustration: ReservationIllustration,
  },
  {
    key: "partidos",
    icon: Users,
    eyebrow: "02 · Completá un partido",
    title: "¿Te falta uno para jugar?",
    highlight: "Encontralo en PadeLibre.",
    text: "Armá un partido abierto o unite a uno que ya está armado cerca tuyo. Cuando se completan los 4 jugadores, cada uno paga su parte con Mercado Pago.",
    Illustration: OpenMatchIllustration,
  },
  {
    key: "torneos",
    icon: Trophy,
    eyebrow: "03 · Descubrí torneos",
    title: "Dejá de perderte cómo va el torneo.",
    highlight: "Seguilo desde la app, hasta la final.",
    text: "Inscribite por categoría y mirá zonas, clasificación y cuadro en tiempo real, sin preguntarle a nadie cómo vas.",
    Illustration: TournamentIllustration,
  },
  {
    key: "entrenamientos",
    icon: Dumbbell,
    eyebrow: "04 · Entrená",
    title: "Mirá los entrenamientos de tu club y anotate en un toque.",
    text: "Consultá días, horarios y cupos de las actividades que organiza tu club, y anotate directamente desde PadeLibre.",
    Illustration: TrainingIllustration,
  },
  {
    key: "comunidad",
    icon: Sparkles,
    eyebrow: "05 · Conectate",
    title: "Enterate de todo lo que pasa en tu club.",
    text: "Novedades, torneos, partidos abiertos y jugadores de tu categoría, todo en un mismo lugar.",
    Illustration: CommunityIllustration,
  },
];

export default function LandingPage() {
  return (
    <main className="landing-light min-h-screen bg-white text-[#0F172A]">
      <LandingNav active="home" />

      {/* Hero — sin gráfico protagonista: vende con tipografía, color y CTA */}
      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24" style={{ background: heroGradient }}>
        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-[#CCFF00]/20 px-3 py-1 text-xs font-bold text-[#CCFF00]"
          >
            La app de pádel argentina
          </motion.span>

          <motion.h1
            className="text-5xl font-extrabold leading-[1.03] tracking-tight text-white sm:text-6xl lg:text-7xl"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
          >
            Tu próximo partido{" "}
            <br className="hidden sm:block" />
            empieza acá.
          </motion.h1>

          <motion.p
            className="mt-5 max-w-xl text-lg font-medium text-white/85 sm:text-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12 }}
          >
            Reservá canchas, encontrá jugadores y descubrí torneos cerca tuyo. Todo desde PadeLibre.
          </motion.p>

          <motion.div
            className="mt-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
          >
            <DownloadBadges />
          </motion.div>

          <motion.p
            className="mt-6 text-sm text-white/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="font-bold text-white underline underline-offset-2 hover:text-[#CCFF00]">
              Iniciá sesión
            </Link>{" "}
            · Gratis para jugadores
          </motion.p>
        </div>
      </section>

      {/* Narrativa de producto */}
      <section className="px-4 py-16 sm:px-6 sm:py-24" style={{ background: softSectionBg }}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 sm:gap-24">
          {sections.map((s, idx) => {
            const Icon = s.icon;
            const reversed = idx % 2 === 1;
            const Illustration = s.Illustration;
            return (
              <div
                key={s.key}
                className={`flex flex-col items-center gap-8 lg:flex-row lg:gap-16 ${
                  reversed ? "lg:flex-row-reverse" : ""
                }`}
              >
                <Reveal className="max-w-md text-center lg:text-left" y={24}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#0461C4]">{s.eyebrow}</p>
                  <div className="mb-3 inline-flex rounded-xl bg-[#0085FC]/10 p-2.5">
                    <Icon className="h-5 w-5 text-[#0085FC]" strokeWidth={1.75} />
                  </div>
                  <h2 className="text-2xl font-extrabold leading-[1.15] tracking-tight text-[#031733] sm:text-3xl">
                    {s.title}
                    {s.highlight && (
                      <>
                        <br />
                        <span className="text-[#0461C4]">{s.highlight}</span>
                      </>
                    )}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-[#475569] sm:text-base">{s.text}</p>
                </Reveal>
                <Reveal delay={0.1} y={24} className="w-full max-w-sm">
                  <Illustration />
                </Reveal>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bloque clubes */}
      <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20" style={{ background: bandGradient }}>
        <CourtLines className="pointer-events-none absolute -right-16 -top-10 hidden w-[360px] lg:block" opacity={0.14} />
        <Reveal className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-5 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#CCFF00]/20 px-3 py-1 text-xs font-bold text-[#CCFF00]">
            Para dueños de club
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            ¿Tenés un club de pádel?
          </h2>
          <p className="max-w-xl text-sm text-white/80 sm:text-base">
            Reservas, torneos, entrenamientos, jugadores y finanzas, desde un solo panel conectado con esta
            misma app.
          </p>
          <Link
            href="/para-clubes"
            className="mt-2 rounded-xl bg-[#CCFF00] px-6 py-3 text-sm font-bold text-[#031733] shadow-lg transition hover:-translate-y-0.5 hover:brightness-95 active:scale-[0.98]"
          >
            Conocé PadeLibre para clubes
          </Link>
        </Reveal>
      </section>

      {/* CTA final descarga — cierre luminoso, no un bloque oscuro vacío */}
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28" style={{ background: limaSoftBg }}>
        <CourtLines className="pointer-events-none absolute -left-20 bottom-[-60px] hidden w-[380px] lg:block" color="#0085FC" opacity={0.08} />
        <Reveal className="relative mx-auto flex w-full max-w-2xl flex-col items-center gap-6 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-[#031733] sm:text-4xl">
            El próximo partido empieza con vos.
          </h2>
          <p className="text-sm text-[#475569] sm:text-base">
            Descargala gratis y empezá a jugar en minutos.
          </p>
          <div className="rounded-2xl bg-white px-6 py-8 shadow-[0_20px_60px_-30px_rgba(4,97,196,0.35)] sm:px-10">
            <DownloadBadges />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <Link href="/login" className="font-bold text-[#0461C4] hover:text-[#0085FC]">
              Iniciar sesión
            </Link>
            <span className="text-[#94A3B8]">·</span>
            <Link href="/para-clubes" className="font-bold text-[#0461C4] hover:text-[#0085FC]">
              PadeLibre para clubes
            </Link>
          </div>
        </Reveal>
      </section>

      <LandingFooter />
    </main>
  );
}
