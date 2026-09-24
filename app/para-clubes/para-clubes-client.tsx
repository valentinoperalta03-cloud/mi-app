"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  Trophy,
  Dumbbell,
  Repeat,
  Wallet,
  ShoppingBag,
  Coffee,
  MessageSquareText,
  ChevronDown,
  MessageCircle,
  Presentation,
} from "lucide-react";
import ClubContactForm from "@/components/landing/club-contact-form";
import LandingNav from "@/components/landing/landing-nav";
import LandingFooter from "@/components/landing/landing-footer";
import Reveal from "@/components/landing/reveal";
import { heroGradient, limaSoftBg, softSectionBg } from "@/components/landing/tokens";
import ClubLinkIllustration from "@/components/landing/illustrations/club-link-illustration";
import OnlinePaymentFlowIllustration from "@/components/landing/illustrations/online-payment-flow-illustration";
import ClubSupportIllustration from "@/components/landing/illustrations/club-support-illustration";
import CourtLines from "@/components/landing/illustrations/court-lines";
import ClubHubIllustration from "@/components/landing/illustrations/club-hub-illustration";
import ClubReservationIllustration from "@/components/landing/illustrations/club-reservation-illustration";
import ClubTournamentIllustration from "@/components/landing/illustrations/club-tournament-illustration";
import ClubTrainingIllustration from "@/components/landing/illustrations/club-training-illustration";
import FinanceIllustration from "@/components/landing/illustrations/finance-illustration";

const REGISTRO_HREF = "/registro-club";
const PRESENTACION_HREF = "https://claude.ai/artifact/WCDeZ3fd6hCUGPD4aTpYZb";
const PRESENTACION_PORTADA_SRC = "/presentacion-clubes-portada.webp";

function CtaButton({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={REGISTRO_HREF}
      className={`inline-flex items-center justify-center rounded-xl bg-[#CCFF00] px-6 py-3 text-sm font-bold text-[#031733] shadow-lg transition hover:-translate-y-0.5 hover:brightness-95 active:scale-[0.98] ${className}`}
    >
      {children}
    </Link>
  );
}

function PresentacionCta({ className = "" }: { className?: string }) {
  return (
    <a
      href={PRESENTACION_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className={`items-center justify-center gap-2 rounded-xl bg-[#CCFF00] px-6 py-3 text-sm font-bold text-[#031733] shadow-lg transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0085FC] focus-visible:ring-offset-2 active:scale-[0.98] ${className}`}
    >
      <Presentation className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      Ver presentación completa
    </a>
  );
}

const flowSteps = [
  { title: "Conocé la plataforma", text: "Un panel de gestión pensado para clubes de pádel, conectado con la app que usan tus jugadores." },
  { title: "Todo en un mismo lugar", text: "Reservas, torneos, entrenamientos, jugadores y finanzas, sin planillas sueltas." },
  { title: "Crecé con tu comunidad", text: "Tus jugadores descubren tu club, se anotan a torneos y vuelven a reservar desde la app." },
];

const proximamente = [
  {
    icon: ShoppingBag,
    title: "Tienda de accesorios",
    status: "Próximamente",
    text: "Gestión de productos y ventas de accesorios desde el panel del club.",
  },
  {
    icon: Coffee,
    title: "Kiosco del club",
    status: "Próximamente",
    text: "Gestión de ventas de bebidas, alimentos y productos del kiosco.",
  },
  {
    icon: MessageSquareText,
    title: "Recordatorios por WhatsApp",
    status: "En desarrollo",
    text: "Recordatorios automáticos a jugadores sobre reservas y actividades.",
  },
];

const faqs = [
  {
    q: "¿Qué necesito para empezar?",
    a: "Registrar tu club con nombre, email y contraseña. Después completás la configuración de canchas, precios y servicios desde el panel.",
  },
  {
    q: "¿Puedo gestionar varias canchas?",
    a: "Sí, podés cargar todas las canchas de tu club, cada una con su propio calendario y disponibilidad.",
  },
  {
    q: "¿Mis jugadores necesitan descargar la app?",
    a: "Para reservar, unirse a partidos abiertos e inscribirse a torneos sí necesitan la app o ingresar desde el navegador con su cuenta. Vos podés cargar jugadores sin cuenta como invitados desde el panel.",
  },
  {
    q: "¿Puedo organizar torneos y entrenamientos?",
    a: "Sí, podés crear torneos con categorías y zonas, y publicar entrenamientos o actividades para que tus jugadores se anoten.",
  },
  {
    q: "¿Cómo funciona la prueba gratuita?",
    a: "Tenés 15 días para usar PadeLibre en tu club sin costo. No te pedimos tarjeta hasta que decidís activar la suscripción.",
  },
  {
    q: "¿Cuánto cuesta PadeLibre?",
    a: "Un pago simple y fijo por mes, por club. PadeLibre no cobra comisión sobre lo que tus jugadores pagan por reservas: ese dinero va 100% a tu cuenta de Mercado Pago. Empezá con los 15 días de prueba gratis y te contamos el detalle al registrar tu club.",
  },
  {
    q: "¿Quién me ayuda a empezar?",
    a: "Contamos con representantes comerciales por ciudad que acompañan a los clubes durante su incorporación. Si todavía no hay uno en tu zona, te acompaña directamente el equipo de PadeLibre.",
  },
  {
    q: "¿Puedo administrar desde el celular?",
    a: "Sí, el panel de administración funciona desde el navegador de tu celular o computadora.",
  },
  {
    q: "¿Cuándo estarán disponibles el kiosco, la tienda y los recordatorios por WhatsApp?",
    a: "Están en desarrollo dentro de nuestro roadmap de producto. Todavía no tenemos fecha de lanzamiento confirmada.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-[#DCEBFF] bg-white px-4 py-3.5 open:shadow-[0_14px_36px_-24px_rgba(4,97,196,0.3)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-[#031733]">
        {q}
        <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B] transition group-open:rotate-180" />
      </summary>
      <p className="mt-2.5 text-sm leading-relaxed text-[#475569]">{a}</p>
    </details>
  );
}

export default function ParaClubesClient() {
  return (
    <main className="landing-light min-h-screen bg-white text-[#0F172A]">
      <LandingNav active="clubes" />

      {/* Hero — sin gráfico protagonista: copy, precio y CTA hacen el trabajo */}
      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24" style={{ background: heroGradient }}>
        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-[#CCFF00]/20 px-3 py-1 text-xs font-bold text-[#CCFF00]"
          >
            Gestión para clubes de pádel
          </motion.span>

          <motion.h1
            className="text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
          >
            Basta de planillas sueltas{" "}
            <br className="hidden sm:block" />
            y mensajes de WhatsApp.
          </motion.h1>

          <motion.p
            className="mt-5 max-w-xl text-lg font-medium text-white/85 sm:text-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12 }}
          >
            Reservas, torneos, entrenamientos, jugadores y finanzas, conectados con la app que ya usan tus
            jugadores.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
          >
            <CtaButton>Quiero PadeLibre en mi club</CtaButton>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white">
              15 días de prueba gratis · Sin tarjeta hasta que lo actives
            </span>
          </motion.div>

          <motion.p
            className="mt-6 flex flex-col items-center gap-2 text-sm text-white/75 sm:flex-row sm:gap-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            <span>
              ¿Preferís hablar antes?{" "}
              <a href="#contacto" className="font-bold text-white underline underline-offset-2 hover:text-[#CCFF00]">
                Quiero que me contacten
              </a>
            </span>
            <span>
              ¿Ya tenés cuenta?{" "}
              <Link href="/login" className="font-bold text-white underline underline-offset-2 hover:text-[#CCFF00]">
                Iniciá sesión
              </Link>
            </span>
          </motion.p>
        </div>
      </section>

      {/* Todo conectado */}
      <section className="px-4 py-16 sm:px-6 sm:py-24" style={{ background: softSectionBg }}>
        <Reveal className="mx-auto mb-12 w-full max-w-3xl text-center">
          <h2 className="text-2xl font-extrabold leading-[1.15] tracking-tight text-[#031733] sm:text-3xl">
            ¿Cansado de saltar entre planillas, WhatsApp y el cuaderno de la recepción?
            <br /> <span className="text-[#0461C4]">Todo tu club en un solo panel.</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#475569] sm:text-base">
            Reservas, torneos, entrenamientos, jugadores y finanzas en un mismo sistema, conectado con la
            aplicación que usan tus jugadores.
          </p>
        </Reveal>

        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row lg:gap-14">
          <Reveal className="w-full max-w-sm shrink-0">
            <ClubHubIllustration />
          </Reveal>
          <div className="flex w-full max-w-md flex-col gap-4">
            {flowSteps.map((s, idx) => {
              const isLast = idx === flowSteps.length - 1;
              return (
                <Reveal key={s.title} delay={idx * 0.1} className="flex gap-3.5 rounded-2xl bg-white/70 p-4">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isLast ? "bg-[#CCFF00] text-[#1F2900]" : "bg-[#0085FC] text-white"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-[#031733]">{s.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{s.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Reservas */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row lg:gap-16">
          <Reveal className="max-w-md text-center lg:text-left">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#0461C4]">Reservas</p>
            <div className="mb-3 inline-flex rounded-xl bg-[#0085FC]/10 p-2.5">
              <CalendarCheck className="h-5 w-5 text-[#0085FC]" strokeWidth={1.75} />
            </div>
            <h2 className="text-2xl font-extrabold leading-[1.15] tracking-tight text-[#031733] sm:text-3xl">
              Dejá de responder disponibilidad todo el día.
              <br /> <span className="text-[#0461C4]">Que tus jugadores reserven solos.</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#475569] sm:text-base">
              Ven disponibilidad en tiempo real y reservan desde la app o desde el link de tu club, sin
              llamarte. Vos ves la ocupación de todas tus canchas de un vistazo.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="w-full max-w-sm">
            <ClubReservationIllustration />
          </Reveal>
        </div>

        {/* Link propio del club */}
        <div className="mx-auto mt-20 flex w-full max-w-5xl flex-col items-center gap-10 lg:mt-28 lg:flex-row-reverse lg:gap-16">
          <Reveal className="max-w-md text-center lg:text-left">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#0461C4]">Tu link de reservas</p>
            <h3 className="text-2xl font-extrabold leading-[1.15] tracking-tight text-[#031733] sm:text-3xl">
              Tu club tiene su propio link.
              <br /> <span className="text-[#0461C4]">Tus jugadores saben dónde reservar.</span>
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[#475569] sm:text-base">
              Compartilo por WhatsApp, en la bio de Instagram o donde ya hablás con tus jugadores. Entran
              directo a la página de tu club, ven tus canchas y horarios disponibles, y reservan.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="w-full max-w-sm">
            <ClubLinkIllustration />
          </Reveal>
        </div>

        {/* Cobro online integrado a la reserva */}
        <div className="mx-auto mt-20 w-full max-w-5xl rounded-[36px] px-5 py-10 sm:px-10 sm:py-12 lg:mt-28" style={{ background: limaSoftBg }}>
          <Reveal className="mx-auto mb-8 max-w-2xl text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#0461C4]">Cobro online</p>
            <h3 className="text-2xl font-extrabold leading-[1.15] tracking-tight text-[#031733] sm:text-3xl">
              Dejá de perseguir transferencias para confirmar una reserva.
            </h3>
            <p className="mx-auto mt-4 inline-block rounded-2xl bg-[#CCFF00] px-4 py-2 text-base font-extrabold text-[#1F2900] sm:text-lg">
              El jugador paga online. Vos ves la reserva confirmada.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[#475569] sm:text-base">
              La seña se paga con Mercado Pago dentro del mismo proceso de reserva y se acredita en la cuenta
              de Mercado Pago de tu club. Cuando el pago se aprueba, la reserva queda confirmada y registrada
              en tu panel, sin pedir comprobantes.
            </p>
          </Reveal>
          <OnlinePaymentFlowIllustration />
          <Reveal delay={0.2} className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-[#64748B]">
            Vos elegís la seña: monto fijo o porcentaje. Si no configurás una, se cobra el total del turno
            online. El saldo restante se abona en el club.
          </Reveal>
        </div>
      </section>

      {/* Torneos */}
      <section className="px-4 py-16 sm:px-6 sm:py-24" style={{ background: softSectionBg }}>
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row-reverse lg:gap-16">
          <Reveal className="max-w-md text-center lg:text-left">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#0461C4]">Torneos</p>
            <div className="mb-3 inline-flex rounded-xl bg-[#0085FC]/10 p-2.5">
              <Trophy className="h-5 w-5 text-[#0085FC]" strokeWidth={1.75} />
            </div>
            <h2 className="text-2xl font-extrabold leading-[1.15] tracking-tight text-[#031733] sm:text-3xl">
              Dejá de perder horas armando zonas y cuadros a mano.
              <br /> <span className="text-[#0461C4]">Que PadeLibre haga los cálculos por vos.</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#475569] sm:text-base">
              Armá categorías, generá zonas y cuadros, programá los cruces y cargá resultados a medida que se
              juegan. Vos organizás; tus jugadores se inscriben y siguen todo desde la app.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="w-full max-w-sm">
            <ClubTournamentIllustration />
          </Reveal>
        </div>
      </section>

      {/* Entrenamientos + turnos fijos */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <Reveal className="mx-auto mb-10 w-full max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-[#031733] sm:text-3xl">
            Tus clases organizadas. Tus jugadores anotados.
          </h2>
        </Reveal>
        <div className="mx-auto grid w-full max-w-5xl gap-6 sm:grid-cols-2">
          <Reveal className="flex flex-col items-center gap-5 rounded-3xl bg-[#F7FAFF] p-6 text-center sm:items-start sm:text-left">
            <div className="inline-flex rounded-xl bg-[#0085FC]/10 p-2.5">
              <Dumbbell className="h-5 w-5 text-[#0085FC]" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#031733]">Publicá, ellos se anotan.</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                Cargá actividades y clases con fecha, horario y cupos. Tus jugadores se anotan directamente
                desde la app, sin pasarte por WhatsApp.
              </p>
            </div>
            <ClubTrainingIllustration />
          </Reveal>
          <Reveal delay={0.1} className="flex flex-col items-center gap-5 rounded-3xl bg-[#F7FAFF] p-6 text-center sm:items-start sm:text-left">
            <div className="inline-flex rounded-xl bg-[#0085FC]/10 p-2.5">
              <Repeat className="h-5 w-5 text-[#0085FC]" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#031733]">Tus recurrentes, siempre a la vista.</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                Cargá los horarios habituales de tus jugadores fijos y consultá su ocupación desde el panel,
                sin volver a preguntarles.
              </p>
            </div>
            <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-[0_14px_36px_-26px_rgba(4,97,196,0.3)]">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#94A3B8]">
                  <Repeat className="h-3 w-3" /> Se repite cada semana
                </span>
                <span className="rounded-full bg-[#EAF3FF] px-2 py-0.5 text-[9px] font-bold text-[#0461C4]">8 activos</span>
              </div>
              <div className="mb-3 flex items-center gap-2">
                {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((d, i) => (
                  <div
                    key={d}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-bold ${
                      i === 1 || i === 3 ? "bg-[#CCFF00] text-[#1F2900]" : "bg-[#F5F8FF] text-[#94A3B8]"
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { court: "Cancha 1", when: "Martes y Jueves · 19:00 hs" },
                  { court: "Cancha 3", when: "Lunes y Miércoles · 20:00 hs" },
                ].map((t) => (
                  <div key={t.court} className="flex items-center justify-between rounded-xl bg-[#F7FAFF] px-3 py-2">
                    <span className="text-[11px] font-bold text-[#0F172A]">{t.court}</span>
                    <span className="text-[10px] font-semibold text-[#0461C4]">{t.when}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Finanzas */}
      <section className="px-4 py-16 sm:px-6 sm:py-24" style={{ background: softSectionBg }}>
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row lg:gap-16">
          <Reveal className="max-w-md text-center lg:text-left">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#0461C4]">Finanzas y reportes</p>
            <div className="mb-3 inline-flex rounded-xl bg-[#0085FC]/10 p-2.5">
              <Wallet className="h-5 w-5 text-[#0085FC]" strokeWidth={1.75} />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-[#031733] sm:text-3xl">
              Sabé cuánto cobraste sin abrir una planilla.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#475569] sm:text-base">
              Las señas cobradas online quedan registradas solas en tu panel. Los saldos y cobros en
              efectivo o transferencia los cargás desde el mismo lugar, y ves cobrado, pendiente y ocupación
              juntos.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="w-full max-w-sm">
            <FinanceIllustration />
          </Reveal>
        </div>
      </section>

      {/* Próximamente */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <Reveal className="mx-auto mb-10 w-full max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-[#031733] sm:text-3xl">Y esto recién empieza.</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#475569] sm:text-base">
            Estamos desarrollando nuevas herramientas para que puedas gestionar cada vez más áreas de tu club
            desde un solo lugar.
          </p>
        </Reveal>
        <div className="mx-auto grid w-full max-w-4xl gap-4 sm:grid-cols-3">
          {proximamente.map((p, idx) => (
            <Reveal key={p.title} delay={idx * 0.08} className="rounded-2xl border border-[#DCEBFF] bg-white p-5 shadow-[0_14px_36px_-26px_rgba(4,97,196,0.3)]">
              <div className="mb-3 inline-flex rounded-xl bg-[#EAF3FF] p-2.5">
                <p.icon className="h-5 w-5 text-[#0461C4]" strokeWidth={1.75} />
              </div>
              <span className="inline-block rounded-full bg-[#CCFF00]/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#4a5a00]">
                {p.status}
              </span>
              <h3 className="mt-2 text-sm font-bold text-[#031733]">{p.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#64748B]">{p.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-16 sm:px-6 sm:py-24" style={{ background: softSectionBg }}>
        <Reveal className="mx-auto mb-8 w-full max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-[#031733] sm:text-3xl">Preguntas frecuentes</h2>
        </Reveal>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {faqs.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* Presentación comercial descargable — después de conocer el producto, antes del cierre */}
      <section className="overflow-x-clip px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-[4fr_7fr] lg:gap-14">
          <Reveal className="mx-auto max-w-md text-center lg:mx-0 lg:text-left">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#0461C4]">
              Presentación comercial para clubes
            </p>
            <h2 className="text-2xl font-extrabold leading-[1.15] tracking-tight text-[#031733] sm:text-3xl lg:text-4xl">
              Conocé PadeLibre en profundidad.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#475569] sm:text-base">
              Descubrí cómo funciona la plataforma, qué podés gestionar desde tu club y cómo la utilizan tus
              jugadores.
            </p>
            <PresentacionCta className="mt-7 hidden lg:inline-flex" />
          </Reveal>

          <Reveal delay={0.1} className="w-full">
            <a
              href={PRESENTACION_HREF}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ver la presentación comercial de PadeLibre (se abre en una pestaña nueva)"
              className="group relative block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0085FC] focus-visible:ring-offset-4"
            >
              {/* Hoja trasera: sugiere un mazo de diapositivas sin simular un mockup */}
              <div
                aria-hidden
                className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-2xl bg-[#EAF3FF] ring-1 ring-[#DCEBFF] transition duration-300 group-hover:translate-x-3.5 group-hover:translate-y-3.5 sm:translate-x-4 sm:translate-y-4"
              />
              <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_-30px_rgba(4,97,196,0.45)] ring-1 ring-[#DCEBFF] transition duration-300 group-hover:-translate-y-1 group-hover:ring-[#0085FC]/50">
                <div className="relative aspect-video w-full">
                  <Image
                    src={PRESENTACION_PORTADA_SRC}
                    alt="Portada de la presentación comercial de PadeLibre para clubes de pádel"
                    fill
                    sizes="(min-width: 1152px) 690px, (min-width: 1024px) 60vw, 100vw"
                    className="object-contain"
                  />
                </div>
              </div>
            </a>
            <div className="mt-6 flex items-center justify-between gap-3 px-1 text-xs font-semibold text-[#64748B] sm:mt-7">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="h-2 w-2 rounded-full bg-[#CCFF00] ring-2 ring-[#CCFF00]/30" />
                Presentación para clubes
              </span>
              <span className="text-[#0461C4]">18 diapositivas</span>
            </div>
            <PresentacionCta className="mt-6 flex w-full sm:mx-auto sm:w-auto lg:hidden" />
          </Reveal>
        </div>
      </section>

      {/* Acompañamiento comercial — responde "¿quién me ayuda a empezar?" justo antes del cierre */}
      <section className="px-4 py-16 sm:px-6 sm:py-24" style={{ background: limaSoftBg }}>
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row lg:gap-16">
          <Reveal className="max-w-md text-center lg:text-left">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#0461C4]">
              Una plataforma tecnológica, con personas detrás
            </p>
            <h2 className="text-2xl font-extrabold leading-[1.15] tracking-tight text-[#031733] sm:text-3xl">
              No tenés que incorporar PadeLibre solo.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#475569] sm:text-base">
              Contamos con representantes comerciales por ciudad para acompañar a los clubes que se suman.
              Tenés una persona de referencia mientras ponés en marcha tu club y, si todavía no hay un
              representante en tu zona, te acompaña directamente nuestro equipo.
            </p>
            <a
              href="#contacto"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#0461C4] underline underline-offset-4 hover:text-[#0085FC]"
            >
              Quiero que me contacten
            </a>
          </Reveal>
          <Reveal delay={0.1} className="w-full max-w-sm">
            <ClubSupportIllustration />
          </Reveal>
        </div>
      </section>

      {/* Cierre — dos caminos de conversión conviviendo, no un CTA único */}
      <section id="contacto" className="relative scroll-mt-20 overflow-x-clip px-4 py-20 sm:px-6 sm:py-28">
        <CourtLines className="pointer-events-none absolute -right-20 bottom-[-60px] hidden w-[380px] lg:block" color="#0085FC" opacity={0.08} />
        <Reveal className="relative mx-auto mb-10 w-full max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-[#031733] sm:text-4xl">
            ¿Listo para probar PadeLibre en tu club?
          </h2>
          <p className="mt-3 text-sm text-[#475569] sm:text-base">
            Si ya querés empezar, registrá tu club. Si todavía tenés dudas, dejanos tus datos y te contactamos.
          </p>
        </Reveal>

        <div className="relative mx-auto grid w-full max-w-5xl grid-cols-1 items-start gap-6 lg:grid-cols-[5fr_7fr]">
          <Reveal className="flex flex-col items-center gap-5 rounded-3xl bg-white p-8 text-center shadow-[0_24px_70px_-30px_rgba(4,97,196,0.35)] ring-2 ring-[#CCFF00] lg:sticky lg:top-24">
            <div>
              <h3 className="text-xl font-extrabold text-[#031733]">Ya sé que lo quiero</h3>
              <p className="mt-2 text-sm text-[#475569]">
                Registrá tu club y empezá con 15 días de prueba gratis, sin tarjeta hasta que lo actives.
              </p>
            </div>
            <CtaButton className="w-full px-8 py-3.5 text-base">Quiero PadeLibre en mi club</CtaButton>
            <Link href="/login" className="text-xs font-bold text-[#0461C4] hover:text-[#0085FC]">
              ¿Ya tenés cuenta? Iniciar sesión
            </Link>
          </Reveal>

          <Reveal
            delay={0.1}
            className="relative rounded-3xl bg-white p-6 shadow-[0_24px_70px_-30px_rgba(4,97,196,0.35)] ring-1 ring-[#DCEBFF] sm:p-8"
          >
            <div aria-hidden className="absolute inset-x-8 top-0 h-1 rounded-b-full bg-gradient-to-r from-[#0085FC] via-[#7DD3FC] to-[#CCFF00]" />
            <div className="mb-6 flex items-start gap-4">
              <div className="hidden shrink-0 rounded-2xl bg-[#EAF3FF] p-3 sm:inline-flex">
                <MessageCircle className="h-6 w-6 text-[#0085FC]" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-xl font-extrabold leading-snug tracking-tight text-[#031733] sm:text-2xl">
                  ¿Querés saber cómo funcionaría PadeLibre en tu club?
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#475569] sm:text-base">
                  Contanos qué necesitás mejorar y nuestro equipo se pone en contacto con vos.
                </p>
              </div>
            </div>
            <ClubContactForm />
            <p className="mt-5 border-t border-[#EEF4FF] pt-4 text-xs text-[#64748B]">
              ¿Preferís una videollamada?{" "}
              <Link href="/agenda" className="font-bold text-[#0461C4] hover:text-[#0085FC]">
                Elegí día y horario
              </Link>
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="relative mx-auto mt-8 flex w-full max-w-2xl justify-center">
          <Link href="/" className="text-xs font-bold text-[#0461C4] hover:text-[#0085FC]">
            Ver la app para jugadores
          </Link>
        </Reveal>
      </section>

      <LandingFooter />
    </main>
  );
}
