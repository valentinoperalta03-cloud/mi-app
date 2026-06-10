"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

const problems = [
  {
    title: "El grupo de WhatsApp",
    description:
      "50 mensajes para confirmar 4 jugadores. Alguien no lee, otro cancela a último momento y nadie sabe si la cancha está reservada.",
  },
  {
    title: "El precio misterioso",
    description:
      "¿Cuánto salía? ¿Lo dividimos en 4? ¿Quién le transfiere al club? Siempre hay uno que 'te paga después'.",
  },
  {
    title: "La incertidumbre",
    description:
      "¿Está confirmado el turno? ¿A qué hora era? ¿En qué cancha? Tres llamadas para algo que debería tomar 30 segundos.",
  },
];

const steps = [
  {
    number: "01",
    title: "Elegís el club y la cancha",
    description:
      "Entrás a PadeLibre, buscás los clubes disponibles cerca tuyo y ves en tiempo real qué canchas tienen horarios libres. Ves el precio, la superficie, si es techada o no. Todo antes de comprometerte con algo.",
  },
  {
    number: "02",
    title: "Armás el partido",
    description:
      "Elegís la fecha, el horario y el tipo de partido: amistoso o competitivo. Podés abrirlo para que cualquiera se una, o hacerlo privado e invitar solo a tus amigos. Vos controlás quién juega.",
  },
  {
    number: "03",
    title: "Cada uno paga su parte",
    description:
      "No más transferencias, no más 'te debo'. Cada jugador paga su cuarto del turno directo por la app vía Mercado Pago. El dinero va al club automáticamente. PadeLibre nunca toca tu plata.",
  },
  {
    number: "04",
    title: "A jugar",
    description:
      "Con los 4 jugadores confirmados y pagados, recibís toda la info del partido: club, cancha, horario y el chat grupal del partido para coordinarse antes de llegar. Nada más que hacer. Solo jugar.",
  },
];

const playerItems = [
  "Reservás la cancha en segundos, ves disponibilidad en tiempo real y pagás tu parte sin transferencias",
  "Armás un partido y lo abrís para que otros jugadores de tu nivel se unan — ideal cuando no tenés los 4",
  "Chateás con tu equipo antes y después del partido desde la misma app",
  "Seguís tu evolución con el sistema ELO y ves cómo progresás con cada partido que jugás",
];

const clubItems = [
  "Tus canchas aparecen visibles para todos los jugadores de la zona que buscan dónde jugar",
  "Los cobros son automáticos vía Mercado Pago — el dinero va directo a tu cuenta sin intermediarios",
  "Panel de administración completo: canchas, horarios, precios dinámicos por horario, historial de pagos",
  "Llenás los horarios muertos con jugadores que buscan canchas disponibles en tiempo real",
  "Sin costo para el club — PadeLibre cobra solo al jugador",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen scroll-smooth bg-[var(--bg-app)] text-[var(--text-primary)]">
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

      <motion.section
        className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6"
        style={{ background: "linear-gradient(180deg, #031733 0%, #0461C4 100%)" }}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="PadeLibre logo"
            width={132}
            height={132}
            className="mx-auto mb-6 rounded-3xl shadow-2xl"
            priority
          />
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            El pádel que querés jugar, sin el caos de organizarlo.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-white/90 sm:text-lg">
            Son las 20hs del viernes. Querés jugar. Pero el grupo de WhatsApp no responde, nadie sabe el precio de la
            cancha, y cuando alguien confirma ya es tarde. ¿Te suena familiar? PadeLibre nació para que eso no vuelva
            a pasar.
          </p>
          <Link
            href="#como-funciona"
            className="mt-8 rounded-2xl bg-white px-7 py-3 text-base font-bold text-[#0461C4] transition hover:bg-white/90"
          >
            Descubrí cómo funciona ↓
          </Link>
          <Link
            href="/login"
            className="mt-3 rounded-2xl border border-white/40 bg-white/10 px-7 py-3 text-base font-semibold text-white transition hover:bg-white/20"
          >
            Empezar gratis
          </Link>
          <p className="mt-4 text-xs font-medium text-white/70 sm:text-sm">
            Gratis para jugadores · Sin descargas · Funciona desde el celular
          </p>
        </div>
      </motion.section>

      <motion.section
        className="bg-[var(--bg-app)] px-4 py-14 sm:px-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">¿Cuántas veces te pasó esto?</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {problems.map((problem, idx) => (
              <motion.article
                key={problem.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.35, delay: idx * 0.08 }}
                className="rounded-3xl border border-rose-200/70 bg-[var(--bg-card)] p-6 shadow-sm dark:border-rose-400/20"
              >
                <p className="text-2xl">😤</p>
                <h3 className="mt-3 text-xl font-bold">{problem.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{problem.description}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        id="como-funciona"
        className="bg-[var(--bg-card)] px-4 py-16 sm:px-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className="mx-auto w-full max-w-4xl">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">Así funciona PadeLibre</h2>
          <p className="mt-3 text-center text-[var(--text-secondary)]">
            Cuatro pasos. Todo desde el celular. Sin llamadas.
          </p>
          <div className="mt-9 space-y-4">
            {steps.map((step, idx) => (
              <motion.article
                key={step.number}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.35, delay: idx * 0.08 }}
                className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-app)] p-5 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <p className="text-3xl font-extrabold text-[#0585FC]">{step.number}</p>
                  <div>
                    <h3 className="text-xl font-bold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{step.description}</p>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="px-4 py-16 text-white sm:px-6"
        style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">Tu nivel, medido en serio.</h2>
          <p className="mx-auto mt-4 max-w-4xl text-center text-sm leading-relaxed text-white/90 sm:text-base">
            En PadeLibre cada partido cuenta. Usamos un sistema ELO — el mismo que se usa en ajedrez y fútbol
            profesional — para medir tu nivel real en base a tus resultados. No es un número inventado. Es tu progreso
            real, partido a partido.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              "📈 Subís ganando contra jugadores de tu nivel o superior",
              "📉 Bajás si perdés contra jugadores de menor nivel",
              "🏆 Tu categoría se actualiza automáticamente: de Principiante a Elite",
            ].map((item, idx) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.35, delay: idx * 0.08 }}
                className="rounded-2xl border border-white/30 bg-white/10 p-4 text-sm font-semibold"
              >
                {item}
              </motion.div>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-white/80 sm:text-base">
            ¿Competitivo o amistoso? Vos elegís. En los partidos amistosos el ELO no se mueve — podés jugar tranquilo
            sin presión.
          </p>
        </div>
      </motion.section>

      <motion.section
        className="bg-[var(--bg-app)] px-4 py-16 sm:px-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">Hecho para jugadores de verdad.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="rounded-3xl border border-[#0585FC]/30 bg-[var(--bg-card)] p-6 shadow-sm">
              <h3 className="text-2xl font-bold">Si jugás al pádel</h3>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                {playerItems.map((item) => (
                  <li key={item}>✅ {item}</li>
                ))}
              </ul>
            </article>
            <article className="rounded-3xl border border-emerald-400/40 bg-[var(--bg-card)] p-6 shadow-sm">
              <h3 className="text-2xl font-bold">Si tenés un club</h3>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                {clubItems.map((item) => (
                  <li key={item}>✅ {item}</li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="bg-[var(--bg-card)] px-4 py-16 sm:px-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className="mx-auto w-full max-w-4xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">Disponible en App Store y Google Play</h2>
          <p className="mt-3 text-[var(--text-secondary)]">Descargá la app gratis y empezá a jugar hoy.</p>
          <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
            <a
              href="https://apps.apple.com/app/id6769852990"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-app)] px-4 py-3 font-semibold transition hover:bg-[var(--bg-subtle)]"
            >
              📱 Descargar en App Store
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.padelibre.app"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-app)] px-4 py-3 font-semibold transition hover:bg-[var(--bg-subtle)]"
            >
              🤖 Descargar en Google Play
            </a>
          </div>
          <p className="mt-5 text-sm text-[var(--text-secondary)]">
            También disponible en padelibre.online desde el navegador
          </p>
        </div>
      </motion.section>

      <motion.section
        className="px-4 py-16 text-center sm:px-6"
        style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className="mx-auto w-full max-w-4xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-white">¿Listo para jugar sin el caos?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-white/90">
            Unite a PadeLibre hoy. Es gratis para jugadores. Reservá canchas, armá partidos y encontrá tu nivel.
          </p>
          <Link
            href="/login"
            className="mt-7 inline-flex rounded-2xl bg-white px-8 py-3 text-base font-bold text-[#0461C4] transition hover:bg-white/90"
          >
            Empezar gratis
          </Link>
          <p className="mt-4 text-sm text-white/85">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="font-semibold text-white underline underline-offset-2">
              Iniciá sesión →
            </Link>
          </p>
        </div>
      </motion.section>

      <footer className="border-t border-[var(--border-default)] px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="PadeLibre" width={28} height={28} className="rounded-lg" />
            <span className="font-semibold">PadeLibre</span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">© 2026 PadeLibre. Hecho en Argentina 🇦🇷</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <a
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              href="mailto:soporte.padelibre@gmail.com"
            >
              Email
            </a>
            <a
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              href="https://instagram.com/padelibre_"
              target="_blank"
              rel="noreferrer"
            >
              Instagram
            </a>
            <a
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              href="https://www.padelibre.online/legal/privacidad"
              target="_blank"
              rel="noreferrer"
            >
              Privacidad
            </a>
            <a
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              href="https://wa.me/5493413741000"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}