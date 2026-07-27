"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  Users,
  CreditCard,
  BarChart2,
  MessageCircle,
  Search,
} from "lucide-react";

const features = [
  {
    icon: CalendarCheck,
    title: "Reservá canchas al instante",
    description: "Ves disponibilidad en tiempo real, el precio y la cancha. Reservás en segundos sin llamar a nadie.",
  },
  {
    icon: Users,
    title: "Armá o unite a partidos",
    description: "Creá un partido y abrilo para que otros jugadores se sumen, o unite a uno ya armado cerca tuyo.",
  },
  {
    icon: CreditCard,
    title: "Cada uno paga su parte",
    description: "Cada jugador paga su cuarto vía Mercado Pago. Sin transferencias, sin 'te debo'.",
  },
  {
    icon: BarChart2,
    title: "Nivel ELO real",
    description: "Tu nivel se actualiza con cada partido competitivo. De Principiante a Elite, medido en serio.",
  },
  {
    icon: MessageCircle,
    title: "Chat del partido",
    description: "Coordiná con tu equipo desde la misma app antes y después de cada partido.",
  },
  {
    icon: Search,
    title: "Encontrá jugadores de tu nivel",
    description: "Filtrá partidos por nivel, género y ciudad. Jugá con gente que va en serio.",
  },
];

function AppleBadge() {
  return (
    <svg viewBox="0 0 135 40" xmlns="http://www.w3.org/2000/svg" className="h-10 w-auto">
      <rect width="135" height="40" rx="8" fill="#000" />
      <text x="40" y="14" fill="white" fontSize="8" fontFamily="system-ui, sans-serif">Disponible en el</text>
      <text x="40" y="27" fill="white" fontSize="14" fontWeight="bold" fontFamily="system-ui, sans-serif">App Store</text>
      <text x="12" y="27" fill="white" fontSize="22" fontFamily="system-ui, sans-serif"></text>
    </svg>
  );
}

function GooglePlayBadge() {
  return (
    <svg viewBox="0 0 135 40" xmlns="http://www.w3.org/2000/svg" className="h-10 w-auto">
      <rect width="135" height="40" rx="8" fill="#000" />
      <text x="40" y="14" fill="white" fontSize="8" fontFamily="system-ui, sans-serif">Disponible en</text>
      <text x="40" y="27" fill="white" fontSize="14" fontWeight="bold" fontFamily="system-ui, sans-serif">Google Play</text>
      <text x="12" y="28" fill="#4FC3F7" fontSize="22" fontFamily="system-ui, sans-serif">▶</text>
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* Nav */}
      <nav
        className="sticky top-0 z-30 border-b border-white/10"
        style={{ background: "linear-gradient(135deg, #031733 0%, #0461C4 100%)" }}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="PadeLibre" width={32} height={32} className="rounded-xl" />
            <span className="text-base font-bold text-white">PadeLibre</span>
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-white/30 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Entrar
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24"
        style={{ background: "linear-gradient(180deg, #031733 0%, #0461C4 60%, #0085FC 100%)" }}
      >
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[500px] rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative mx-auto flex max-w-lg flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45 }}
          >
            <Image
              src="/logo.png"
              alt="PadeLibre"
              width={100}
              height={100}
              className="mx-auto mb-7 rounded-[28px] shadow-2xl"
              priority
            />
          </motion.div>

          <motion.h1
            className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            PadeLibre
          </motion.h1>

          <motion.p
            className="mt-3 text-lg font-medium text-white/80 sm:text-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.18 }}
          >
            Reservá canchas, armá partidos y pagá tu parte. Todo desde el celular.
          </motion.p>

          {/* Download buttons */}
          <motion.div
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.28 }}
          >
            <a
              href="https://apps.apple.com/us/app/padelibre/id6769852990"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl bg-black px-5 py-3 transition hover:opacity-85 active:scale-[0.98]"
            >
              <Image src="/app-store.png" alt="App Store" width={28} height={28} className="shrink-0" />
              <div className="text-left">
                <p className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Disponible en</p>
                <p className="text-base font-bold leading-tight text-white">App Store</p>
              </div>
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.padelibre.app"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl bg-black px-5 py-3 transition hover:opacity-85 active:scale-[0.98]"
            >
              <Image src="/google-play.png" alt="Google Play" width={28} height={28} className="shrink-0" />
              <div className="text-left">
                <p className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Disponible en</p>
                <p className="text-base font-bold leading-tight text-white">Google Play</p>
              </div>
            </a>
          </motion.div>

          <motion.p
            className="mt-5 text-xs text-white/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            También disponible en{" "}
            <Link href="/login" className="underline underline-offset-2 hover:text-white/80">
              padelibre.online
            </Link>{" "}
            desde el navegador · Gratis para jugadores
          </motion.p>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto w-full max-w-5xl">
          <motion.div
            className="mb-10 text-center"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              ¿Qué puedo hacer en PadeLibre?
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Todo lo que necesitás para organizar tu pádel en un solo lugar.
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, idx) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: idx * 0.06 }}
                  className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-sm"
                >
                  <div className="mb-3 inline-flex rounded-xl bg-[#0085FC]/10 p-2.5">
                    <Icon className="h-5 w-5 text-[#0085FC]" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{f.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-default)] px-4 py-7 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="PadeLibre" width={24} height={24} className="rounded-lg" />
            <span className="text-sm font-semibold">PadeLibre</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">© 2026 PadeLibre · Hecho en Argentina 🇦🇷</p>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <a className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]" href="https://www.instagram.com/padelibre_" target="_blank" rel="noreferrer">Instagram</a>
            <a className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]" href="https://www.tiktok.com/@padelibre" target="_blank" rel="noreferrer">TikTok</a>
            <a className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]" href="https://www.padelibre.online/legal/privacidad" target="_blank" rel="noreferrer">Privacidad</a>
            <a
              href="https://api.whatsapp.com/send/?phone=5493413741000&text&type=phone_number&app_absent=0"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] px-3 py-1 text-[var(--text-secondary)] transition hover:border-[#25D366] hover:text-[#25D366]"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
              Soporte
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
