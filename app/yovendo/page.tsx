import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Vendé PadeLibre — Ganá $100.000 por club",
  description:
    "Programa de vendedores de PadeLibre. Sin límite de clubes. 100% a comisión. Unite al equipo.",
  openGraph: {
    title: "Vendé PadeLibre — Ganá $100.000 por club",
    description: "Sin límite de clubes. 100% a resultados.",
  },
};

const WHATSAPP_LINK =
  "https://chat.whatsapp.com/HS4LSIVa1Xz3WR3RPYddCn?s=cl&p=i&ilr=2";

const GANANCIAS = [
  { clubes: "1 club", monto: "$100.000", porcentaje: 5 },
  { clubes: "2 clubes", monto: "$200.000", porcentaje: 10 },
  { clubes: "5 clubes", monto: "$500.000", porcentaje: 25 },
  { clubes: "10 clubes", monto: "$1.000.000", porcentaje: 50 },
  { clubes: "20 clubes", monto: "$2.000.000", porcentaje: 100 },
];

const PASOS = [
  {
    numero: "①",
    texto: "Encontrás un club de pádel y contactás al dueño",
  },
  {
    numero: "②",
    texto:
      "Le mostrás PadeLibre — app del jugador + panel del club — y lo ayudás a incorporarse con 15 días gratis",
  },
  {
    numero: "③",
    texto: "Cuando conecta Mercado Pago y activa su cuenta → $100.000 para vos",
  },
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

export default function YoVendoPage() {
  return (
    <div className={`${spaceGrotesk.variable}`}>
      <div
        className="min-h-screen bg-[#0A1628] text-white"
        style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
      >
        <div className="h-[2px] w-full bg-[#CCFF00]" />

        <main className="mx-auto max-w-[480px] px-5">
          {/* Hero */}
          <section
            className="relative pb-10 pt-8"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 50% 0%, rgba(204,255,0,0.04), transparent 60%)",
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">🎾</span>
              <span className="text-lg font-bold">PadeLibre</span>
            </div>
            <div className="mx-auto mt-6 h-px w-12 bg-white/[0.08]" />

            <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-widest text-[#CCFF00]/70">
              Programa de vendedores
            </p>
            <h1 className="mt-3 text-center text-[32px] font-black leading-tight">
              Vendé PadeLibre y ganá <span className="text-[#CCFF00]">$100.000</span> por
              cada club que incorporés.
            </h1>
            <p className="mt-3 text-center text-sm text-white/60">
              Sin límite de clubes. Sin sueldo fijo. 100% a resultados.
            </p>

            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 block w-full rounded-2xl bg-[#CCFF00] py-4 text-center text-base font-black text-[#0A1628]"
            >
              Quiero ser vendedor →
            </a>
          </section>

          {/* Cómo funciona */}
          <section className="border-t border-white/[0.08] py-10">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#CCFF00]/70">
              Cómo funciona
            </p>
            <div className="mt-6 flex flex-col">
              {PASOS.map((paso, i) => (
                <div
                  key={paso.numero}
                  className={`flex gap-4 pb-6 ${
                    i < PASOS.length - 1
                      ? "border-l-2 border-dashed border-[#CCFF00]/20"
                      : ""
                  }`}
                >
                  <span className="-ml-[21px] shrink-0 bg-[#0A1628] pr-2 text-[40px] font-black leading-none text-[#CCFF00]">
                    {paso.numero}
                  </span>
                  <p className="pt-1 text-sm text-white/80">{paso.texto}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Tabla de ganancias */}
          <section className="border-t border-white/[0.08] py-10">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#CCFF00]/70">
              Cuánto podés ganar
            </p>
            <div className="mt-6 flex flex-col gap-4">
              {GANANCIAS.map((fila) => (
                <div key={fila.clubes}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm text-white/60">{fila.clubes}</span>
                  </div>
                  <div className="flex h-9 w-full items-center rounded-full bg-white/[0.06]">
                    <div
                      className="flex h-9 items-center justify-end rounded-full bg-[#CCFF00] px-3 transition-[width] duration-700 ease-out"
                      style={{ width: `${fila.porcentaje}%` }}
                    >
                      <span className="whitespace-nowrap text-sm font-bold text-[#0A1628]">
                        {fila.monto}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-white/40">
              Sin límite máximo de clubes.
            </p>
          </section>

          {/* Tu trabajo */}
          <section className="border-t border-white/[0.08] py-10">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#CCFF00]/70">
              Tu trabajo
            </p>
            <div className="mt-6 flex flex-col">
              {TRABAJO.map((paso, i) => (
                <div
                  key={paso.titulo}
                  className={`flex gap-3 py-4 ${
                    i < TRABAJO.length - 1 ? "border-b border-white/[0.06]" : ""
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#CCFF00] text-sm font-black text-[#0A1628]">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{paso.titulo}</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/55">
                      {paso.descripcion}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Ventajas */}
          <section className="border-t border-white/[0.08] py-10">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#CCFF00]/70">
              ¿Por qué vender PadeLibre?
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {VENTAJAS.map((v) => (
                <div
                  key={v.titulo}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4"
                >
                  <span className="text-2xl">{v.emoji}</span>
                  <p className="mt-2 text-sm font-bold text-white">{v.titulo}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">
                    {v.descripcion}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Lo que NO hacés */}
          <section className="border-t border-white/[0.08] py-10">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#CCFF00]/70">
              Lo que no es tu trabajo
            </p>
            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
              {NO_HACES.map((item, i) => (
                <div
                  key={item}
                  className={`flex gap-2 py-2.5 ${
                    i < NO_HACES.length - 1 ? "border-b border-white/[0.06]" : ""
                  }`}
                >
                  <span>❌</span>
                  <span className="text-sm text-white/65">{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Cuándo se considera cerrado */}
          <section className="border-t border-white/[0.08] py-10">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#CCFF00]/70">
              ¿Cuándo cobrás?
            </p>
            <div className="mt-6 rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.03] p-5">
              <p className="text-sm text-white/80">
                Un club está cerrado — y la comisión es tuya — cuando:
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex gap-2">
                  <span className="text-[#CCFF00]">✓</span>
                  <span className="text-sm text-white/80">
                    El dueño crea su cuenta en PadeLibre
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#CCFF00]">✓</span>
                  <span className="text-sm text-white/80">
                    Conecta su cuenta de Mercado Pago
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#CCFF00]">✓</span>
                  <span className="text-sm text-white/80">
                    Activa los 15 días de prueba gratuita
                  </span>
                </div>
              </div>
              <p className="mt-4 text-xs text-white/40">
                El club debe efectivamente abonar los dos primeros meses para que la
                comisión quede confirmada.
              </p>
            </div>
          </section>

          {/* CTA final */}
          <section
            className="border-t border-white/[0.08] py-12 text-center"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, rgba(204,255,0,0.06), transparent)",
            }}
          >
            <span className="text-4xl">🚀</span>
            <h2 className="mt-4 text-[28px] font-black text-white">
              ¿Querés empezar?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              Unite a nuestro grupo de WhatsApp. Ahí encontrás todo: explicación del
              modelo, videos de la plataforma y podés hacer todas las consultas que
              necesités.
            </p>
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 block w-full rounded-2xl bg-[#CCFF00] py-4 text-center text-base font-black text-[#0A1628]"
            >
              Unirme al grupo de vendedores →
            </a>
            <p className="mt-2 text-center text-xs text-white/30">
              Gratis. Sin compromiso.
            </p>
          </section>

          <footer className="border-t border-white/[0.06] py-6 text-center">
            <p className="text-xs text-white/25">
              © 2026 PadeLibre. Todos los derechos reservados.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
