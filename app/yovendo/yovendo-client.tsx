"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { XCircle } from "lucide-react";

const WHATSAPP_LINK =
  "https://chat.whatsapp.com/HS4LSIVa1Xz3WR3RPYddCn?s=cl&p=i&ilr=2";

const CARDS = [
  {
    numero: "01",
    emoji: "🔍",
    titulo: "Encontrás el club",
    descripcion:
      "Google Maps, Instagram, contactos, visitas, WhatsApp. Podés venderle a cualquier club de pádel de Argentina.",
  },
  {
    numero: "02",
    emoji: "🎯",
    titulo: "Hacés la demo",
    descripcion:
      "Mostrás la app y el panel. Conectás PadeLibre con los problemas del dueño.",
  },
  {
    numero: "03",
    emoji: "💰",
    titulo: "Cobrás $100.000",
    descripcion:
      "Cuando el club activa su cuenta y conecta MP → la comisión es tuya.",
  },
];

const GANANCIAS = [
  { clubes: "1 club", monto: "$100.000", porcentaje: 5 },
  { clubes: "2 clubes", monto: "$200.000", porcentaje: 10 },
  { clubes: "5 clubes", monto: "$500.000", porcentaje: 25 },
  { clubes: "10 clubes", monto: "$1.000.000", porcentaje: 50 },
  { clubes: "20 clubes", monto: "$2.000.000", porcentaje: 100 },
];

const TRABAJO = [
  {
    titulo: "Prospectar",
    descripcion:
      "Google Maps, Instagram, contactos, visitas, WhatsApp. Podés venderle a cualquier club de pádel de Argentina.",
  },
  {
    titulo: "Llegar al dueño",
    descripcion:
      "El objetivo es hablar con quien toma la decisión, no con el recepcionista ni el encargado.",
  },
  {
    titulo: "Conseguir una reunión",
    descripcion: "15 a 20 minutos con el dueño. Ahí empieza la venta real.",
  },
  {
    titulo: "Hacer la demo",
    descripcion:
      "Mostrás la app del jugador y el panel del club. Primero preguntás cómo gestionan las reservas hoy, después conectás PadeLibre con sus problemas.",
  },
  {
    titulo: "Cerrar",
    descripcion:
      'Que el dueño diga "sí" y avance con el registro. Lo acompañás hasta que el club esté activo.',
  },
];

const VENTAJAS = [
  {
    emoji: "🎯",
    titulo: "Solo vendés",
    descripcion:
      "No desarrollás nada, no das soporte, no administrás. Tu único trabajo es conseguir clubes.",
  },
  {
    emoji: "⚡",
    titulo: "Ingresos rápidos",
    descripcion:
      "Cuando el club activa su cuenta, la comisión es tuya. No esperás semanas.",
  },
  {
    emoji: "📈",
    titulo: "Sin techo",
    descripcion: "1 club = $100k. 10 = $1M. 20 = $2M. Depende solo de cuánto vendés.",
  },
  {
    emoji: "🗂️",
    titulo: "Mercado virgen",
    descripcion:
      "Miles de clubes de pádel en Argentina sin sistema digital. El mercado está sin explotar.",
  },
  {
    emoji: "🎁",
    titulo: "Bonos por volumen",
    descripcion:
      "A más clubes incorporados, más bonos. Cuanto más vendés, más ganás por cada cierre.",
  },
  {
    emoji: "🤝",
    titulo: "Producto real",
    descripcion: "No vendés aire. PadeLibre funciona hoy, con clubes y jugadores reales.",
  },
];

const NO_HACES = [
  "Cobrarle al club los $50.000 mensuales",
  "Manejar el Mercado Pago del club",
  "Recibir transferencias del club",
  "Configurar el club por el dueño",
  "Dar soporte técnico",
  "Prometer funcionalidades que no existen",
  "Decidir condiciones comerciales por tu cuenta",
];

function useCountUp(target: number, durationMs: number, reduceMotion: boolean) {
  const [value, setValue] = useState(reduceMotion ? target : 0);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduceMotion]);

  return value;
}

function CtaButton({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-8 block w-full rounded-2xl bg-[#CCFF00] py-4 text-center text-base font-black text-[#080F1A]"
      animate={reduceMotion ? {} : { scale: [1, 1.015, 1] }}
      transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
    >
      {children}
    </motion.a>
  );
}

function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={
        inView
          ? reduceMotion
            ? { opacity: 1 }
            : { opacity: 1, y: 0 }
          : undefined
      }
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

function GananciaFila({
  fila,
  index,
}: {
  fila: (typeof GANANCIAS)[number];
  index: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion();

  return (
    <FadeIn delay={index * 0.12}>
      <div ref={ref}>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-xs text-white/50">{fila.clubes}</span>
          <span className="font-mono text-sm font-bold text-[#CCFF00]">
            {fila.monto}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
          <motion.div
            className="h-1.5 rounded-full bg-[#CCFF00]"
            initial={{ width: 0 }}
            animate={inView ? { width: `${fila.porcentaje}%` } : { width: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 1,
              delay: reduceMotion ? 0 : index * 0.15,
              ease: "easeOut",
            }}
          />
        </div>
      </div>
    </FadeIn>
  );
}

export default function YoVendoClient() {
  const reduceMotion = useReducedMotion();
  const contador = useCountUp(100000, 2000, !!reduceMotion);
  const [activeCard, setActiveCard] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / CARDS.length;
    const index = Math.round(el.scrollLeft / cardWidth);
    setActiveCard(Math.min(Math.max(index, 0), CARDS.length - 1));
  };

  return (
    <div
      className="min-h-screen bg-[#080F1A] text-white"
      style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
    >
      {/* SECCIÓN 1 — Hero */}
      <section
        className="relative overflow-hidden px-5 pb-12 pt-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(204,255,0,0.15) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 50% 0%, rgba(8,15,26,0.85), rgba(8,15,26,0.85))",
          }}
        />
        <div className="relative mx-auto max-w-[480px]">
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg">🎾</span>
            <span className="font-mono text-xs tracking-widest text-white/40">
              PadeLibre
            </span>
          </div>

          <p className="mt-8 text-center font-mono text-[10px] tracking-[0.2em] text-[#CCFF00]/60">
            PROGRAMA DE VENDEDORES 2026
          </p>

          <div className="mt-4 text-center">
            <div className="text-[72px] font-black leading-none text-[#CCFF00]">
              ${contador.toLocaleString("es-AR")}
            </div>
            <p className="mt-1 font-mono text-xs tracking-wider text-white/40">
              pesos por club incorporado
            </p>
          </div>

          <h1 className="mt-6 text-center text-[36px] font-black leading-tight text-white">
            Vendé PadeLibre.
            <br />
            Ganá sin límite.
          </h1>
          <p className="mt-3 text-center text-sm text-white/50">
            100% a comisión. Sin sueldo fijo. Sin techo.
          </p>

          <CtaButton>Quiero ser vendedor →</CtaButton>
        </div>
      </section>

      {/* SECCIÓN 2 — Cómo funciona */}
      <section
        className="border-y border-[#CCFF00]/[0.15] py-10"
        style={{ backgroundColor: "#0D1A2E" }}
      >
        <div className="mx-auto max-w-[480px] px-5">
          <FadeIn>
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#CCFF00]/70">
              Cómo funciona
            </p>
          </FadeIn>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="mt-6 flex gap-4 overflow-x-auto px-5 pb-2"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {CARDS.map((card) => (
            <div
              key={card.numero}
              className="relative min-w-[80vw] shrink-0 rounded-3xl border border-white/[0.07] bg-[#080F1A] p-6"
              style={{ scrollSnapAlign: "start" }}
            >
              <span className="absolute right-4 top-2 text-[80px] font-black leading-none text-[#CCFF00]/[0.15]">
                {card.numero}
              </span>
              <span className="relative text-3xl">{card.emoji}</span>
              <p className="relative mt-2 text-lg font-bold text-white">
                {card.titulo}
              </p>
              <p className="relative mt-2 text-sm leading-relaxed text-white/55">
                {card.descripcion}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-1.5">
          {CARDS.map((card, i) => (
            <span
              key={card.numero}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === activeCard ? "bg-[#CCFF00]" : "bg-white/20"
              }`}
            />
          ))}
        </div>
      </section>

      {/* SECCIÓN 3 — Gráfico de ganancias */}
      <section className="px-5 py-12" style={{ backgroundColor: "#080F1A" }}>
        <div className="mx-auto max-w-[480px]">
          <FadeIn className="text-center">
            <h2 className="text-[32px] font-black text-white">Tu potencial.</h2>
            <p className="mt-1 text-sm text-white/40">Sin límite de clubes.</p>
          </FadeIn>

          <div className="mt-10 flex flex-col gap-6">
            {GANANCIAS.map((fila, i) => (
              <GananciaFila key={fila.clubes} fila={fila} index={i} />
            ))}
          </div>

          <FadeIn delay={GANANCIAS.length * 0.12} className="mt-10 text-center">
            <p className="text-[24px] font-black text-white/20">Sin techo.</p>
          </FadeIn>
        </div>
      </section>

      {/* SECCIÓN 4 — Tu trabajo */}
      <section className="px-5 py-12" style={{ backgroundColor: "#0D1A2E" }}>
        <div className="mx-auto max-w-[480px]">
          <FadeIn>
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#CCFF00]/70">
              Tu trabajo
            </p>
          </FadeIn>

          <div className="mt-6 flex flex-col">
            {TRABAJO.map((paso, i) => (
              <FadeIn key={paso.titulo} delay={i * 0.12} className="flex">
                <div
                  className={`relative flex-shrink-0 pl-4 ${
                    i < TRABAJO.length - 1
                      ? "border-l border-dashed border-[#CCFF00]/20"
                      : "border-l border-transparent"
                  }`}
                >
                  <span className="absolute -left-4 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-[#CCFF00] text-sm font-black text-[#080F1A]">
                    {i + 1}
                  </span>
                </div>
                <div className="ml-2 mb-6 flex-1 rounded-2xl border border-white/[0.06] bg-[#080F1A] p-4">
                  <p className="text-sm font-bold text-white">{paso.titulo}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">
                    {paso.descripcion}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* SECCIÓN 5 — Ventajas */}
      <section
        className="border-t border-[#CCFF00]/[0.12] px-5 py-12"
        style={{ backgroundColor: "#080F1A" }}
      >
        <div className="mx-auto max-w-[480px]">
          <FadeIn>
            <h2 className="text-[28px] font-black text-white">Por qué funciona.</h2>
          </FadeIn>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {VENTAJAS.map((v, i) => (
              <FadeIn key={v.titulo} delay={i * 0.08}>
                <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#0D1A2E] to-[#080F1A] p-4 transition-colors hover:border-[#CCFF00]/25">
                  <span className="text-[32px]">{v.emoji}</span>
                  <p className="mt-3 text-sm font-bold text-white">{v.titulo}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/50">
                    {v.descripcion}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* SECCIÓN 6 — Lo que NO hacés */}
      <section className="px-5 py-12" style={{ backgroundColor: "#0D1A2E" }}>
        <div className="mx-auto max-w-[480px]">
          <FadeIn>
            <h2 className="text-[24px] font-black text-white">Enfocate en vender.</h2>
            <p className="mt-1 text-sm text-white/40">El resto lo hace PadeLibre.</p>
          </FadeIn>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#080F1A]">
            {NO_HACES.map((item, i) => (
              <FadeIn key={item} delay={i * 0.06}>
                <div
                  className={`flex items-center gap-3 px-5 py-3.5 ${
                    i < NO_HACES.length - 1 ? "border-b border-white/[0.05]" : ""
                  }`}
                >
                  <XCircle className="shrink-0 text-rose-500/60" size={16} />
                  <span className="text-sm text-white/60">{item}</span>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* SECCIÓN 7 — Cuándo cobrás */}
      <section className="px-5 py-12" style={{ backgroundColor: "#080F1A" }}>
        <div className="mx-auto max-w-[480px]">
          <FadeIn>
            <div className="rounded-3xl border border-[#CCFF00]/20 bg-gradient-to-br from-[#CCFF00]/[0.06] to-transparent p-6">
              <p className="text-lg font-bold text-white">
                ¿Cuándo es tuyo el dinero?
              </p>

              <div className="mt-5 flex flex-col gap-3">
                {[
                  "El dueño crea su cuenta en PadeLibre",
                  "Conecta su cuenta de Mercado Pago",
                  "Activa los 15 días de prueba gratuita",
                ].map((texto, i) => (
                  <FadeIn key={texto} delay={i * 0.12} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#CCFF00]">
                      <span className="text-xs font-black text-[#080F1A]">✓</span>
                    </span>
                    <span className="text-sm text-white/80">{texto}</span>
                  </FadeIn>
                ))}
              </div>

              <p className="mt-4 text-xs text-white/30">
                El club debe efectivamente abonar los dos primeros meses para que la
                comisión quede confirmada.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* SECCIÓN 8 — CTA final */}
      <section
        className="px-5 py-16 text-center"
        style={{
          background:
            "linear-gradient(135deg, #0D1A2E 0%, #080F1A 50%, rgba(204,255,0,0.04) 100%)",
        }}
      >
        <div className="mx-auto max-w-[480px]">
          <FadeIn>
            <span className="inline-block rounded-full border border-[#CCFF00]/20 bg-[#CCFF00]/10 px-4 py-1.5 font-mono text-[11px] text-[#CCFF00]/70">
              12 vendedores activos en Argentina 🇦🇷
            </span>

            <h2 className="mt-6 text-[32px] font-black text-white">
              ¿Querés ser parte?
            </h2>
            <p className="mt-3 text-center text-sm leading-relaxed text-white/55">
              Unite a nuestro grupo de WhatsApp. Ahí encontrás todo: explicación del
              modelo, videos de la plataforma y podés hacer todas las consultas que
              necesités.
            </p>

            <CtaButton>Unirme al grupo de vendedores →</CtaButton>
            <p className="mt-2 text-center text-xs text-white/25">
              Gratis. Sin compromiso.
            </p>
          </FadeIn>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-6 text-center">
        <p className="text-xs text-white/25">
          © 2026 PadeLibre. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
