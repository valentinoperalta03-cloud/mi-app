"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

const features = [
  {
    emoji: "🎾",
    title: "Encontrá canchas",
    description: "Reservá en segundos en los mejores clubes cerca tuyo",
  },
  {
    emoji: "👥",
    title: "Armá tu partido",
    description: "Invitá amigos o unite a partidos abiertos cerca tuyo",
  },
  {
    emoji: "📊",
    title: "Seguí tu nivel",
    description: "Sistema ELO que mide tu progreso real en cada partido",
  },
];

const playerItems = [
  "Reservá canchas con un toque",
  "Unite a partidos con tu nivel",
  "Chateá con tu equipo",
  "Seguí tu evolución",
];

const clubItems = [
  "Gestión de canchas y horarios",
  "Cobros automáticos via Mercado Pago",
  "Panel de analytics",
  "Sin comisiones ocultas",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
      <nav
        className="sticky top-0 z-30 border-b border-white/20"
        style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="PadeLibre" width={36} height={36} className="rounded-xl" />
            <span className="text-lg font-bold text-white">PadeLibre</span>
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-white/40 bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
          >
            Entrar
          </Link>
        </div>
      </nav>

      <section
        className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6"
        style={{ background: "linear-gradient(180deg, #031733 0%, #0461C4 100%)" }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="w-full max-w-xl"
          >
            <Image
              src="/logo.png"
              alt="PadeLibre logo"
              width={132}
              height={132}
              className="mx-auto mb-6 rounded-3xl shadow-2xl"
              priority
            />
            <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl">PadeLibre</h1>
            <p className="mt-3 text-lg font-medium text-white/90 sm:text-xl">
              Que organizar no sea un problema.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="rounded-2xl bg-white px-7 py-3 text-base font-bold text-[#0461C4] transition hover:bg-white/90"
              >
                Empezar gratis
              </Link>
              <Link
                href="/login"
                className="rounded-2xl border border-white/40 bg-white/10 px-7 py-3 text-base font-semibold text-white transition hover:bg-white/20"
              >
                Ver demo
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto grid w-full max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.35, delay: index * 0.08 }}
              className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-sm"
            >
              <p className="text-2xl">{feature.emoji}</p>
              <h2 className="mt-3 text-xl font-bold">{feature.title}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{feature.description}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6">
        <div className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-2">
          <article className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-sm">
            <h3 className="text-2xl font-bold">Jugadores</h3>
            <ul className="mt-4 space-y-2 text-[var(--text-secondary)]">
              {playerItems.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-sm">
            <h3 className="text-2xl font-bold">Clubes</h3>
            <ul className="mt-4 space-y-2 text-[var(--text-secondary)]">
              {clubItems.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section
        className="mx-4 mb-12 rounded-3xl px-6 py-12 text-center sm:mx-6"
        style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
      >
        <p className="text-3xl font-extrabold text-white">¿Listo para jugar?</p>
        <p className="mt-2 text-white/90">Unite a la comunidad de pádel argentina.</p>
        <Link
          href="/register"
          className="mt-7 inline-flex rounded-2xl bg-white px-8 py-3 text-base font-bold text-[#0461C4] transition hover:bg-white/90"
        >
          Empezar gratis
        </Link>
      </section>

      <footer className="border-t border-[var(--border-default)] px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="PadeLibre" width={28} height={28} className="rounded-lg" />
            <span className="font-semibold">PadeLibre</span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">© 2025 PadeLibre. Hecho en Argentina 🇦🇷</p>
          <div className="flex gap-4 text-sm">
            <a className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]" href="mailto:soporte.padelibre@gmail.com">
              Contacto
            </a>
            <a
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              href="https://instagram.com/padelibre"
              target="_blank"
              rel="noreferrer"
            >
              Instagram
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}