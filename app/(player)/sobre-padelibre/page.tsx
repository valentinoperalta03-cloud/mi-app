import { MessageCircle } from "lucide-react";
import MotionPage from "@/components/motion-page";
import { PlayerStackHeader } from "@/components/player-back-button";

export default function SobrePadelibrePage() {
  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      <PlayerStackHeader
        backHref="/home"
        backLabel="Volver"
        title="Un poco más de PadeLibre"
        subtitle="Nuestra historia y misión"
      />

      <section
        className="relative overflow-hidden rounded-3xl p-7 text-white"
        style={{ background: "linear-gradient(135deg, #0085FC 0%, #0461C4 100%)" }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Nuestra historia</p>
        <h2 className="mt-3 text-xl font-semibold leading-tight">Nació en un viaje. Creció en Argentina.</h2>
        <p className="mt-4 text-sm leading-relaxed text-white/85">
          En Europa vimos cómo los clubes deportivos tenían todo automatizado y digitalizado. Reservas online, pagos
          divididos, comunidades activas. Volvimos a Argentina con una pregunta: ¿por qué acá no existe algo así para el
          pádel?
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/85">
          PadeLibre nació para cerrar esa brecha. Somos una plataforma argentina que conecta jugadores y clubes, elimina
          la burocracia y hace que organizar un partido sea tan fácil como mandar un mensaje.
        </p>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#0085FC]">Para jugadores</p>
          <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Los problemas que eliminamos</h3>
        </div>
        <div className="space-y-3">
          {[
            {
              emoji: "📞",
              title: "Nada más de llamar a 5 clubes",
              desc: "Mirá la disponibilidad real de canchas en segundos, sin llamadas ni mensajes de WhatsApp.",
            },
            {
              emoji: "💸",
              title: "Chau a cobrarle a tus amigos",
              desc: "Cada jugador paga su parte directamente al unirse. Sin deudas, sin incómodos.",
            },
            {
              emoji: "🎯",
              title: "Encontrá partidos de tu nivel",
              desc: "Sistema de ranking ELO que mide tu progreso real y te conecta con jugadores compatibles.",
            },
            {
              emoji: "👥",
              title: "¿Te falta uno? Lo encontramos",
              desc: "Publicá tu partido como abierto y el sistema busca al jugador ideal por nivel.",
            },
            {
              emoji: "🏆",
              title: "Competí en torneos",
              desc: "Torneos americanos, eliminación directa y por grupos. Todo organizado desde la app.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="flex gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]"
            >
              <span className="text-2xl">{item.emoji}</span>
              <div>
                <p className="font-semibold text-[var(--text-primary)]">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{item.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#0085FC]">Para clubes</p>
          <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Tu club en piloto automático</h3>
        </div>
        <div className="space-y-3">
          {[
            {
              emoji: "📅",
              title: "Reservas 24/7",
              desc: "Recibí reservas mientras el club está cerrado. Tu agenda se actualiza sola.",
            },
            {
              emoji: "💳",
              title: "Cero deudas y no-shows",
              desc: "Las reservas se confirman solo con el pago realizado. El dinero va directo a tu cuenta.",
            },
            {
              emoji: "📊",
              title: "Métricas en tiempo real",
              desc: "Panel de control con ingresos, ocupación y horarios más rentables.",
            },
            {
              emoji: "⚡",
              title: "Eliminá los huecos",
              desc: "Los partidos abiertos ayudan a completar turnos en horarios muertos automáticamente.",
            },
            {
              emoji: "🎾",
              title: "Torneos propios",
              desc: "Organizá torneos desde el panel admin con inscripción y pagos integrados.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="flex gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]"
            >
              <span className="text-2xl">{item.emoji}</span>
              <div>
                <p className="font-semibold text-[var(--text-primary)]">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{item.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-[#0085FC]/15 bg-gradient-to-b from-[#0085FC]/5 to-transparent p-5">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Un modelo justo para todos</h3>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Los clubes acceden a PadeLibre con una suscripción mensual fija. Sin comisión por reserva, sin letra chica.
        </p>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Para los jugadores, no hay ninguna comisión adicional — el precio que ves al reservar es el precio que pagás.
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Seguinos y escribinos</h3>
        <div className="space-y-3">
          <a
            href="https://www.instagram.com/padelibre_"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] transition active:scale-[0.98]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
                aria-hidden
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-primary)]">Instagram</p>
              <p className="text-sm text-[var(--text-tertiary)]">@padelibre_</p>
            </div>
          </a>

          <a
            href="https://www.tiktok.com/@padelibre"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] transition active:scale-[0.98]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black dark:bg-white">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-white dark:text-black"
                aria-hidden
              >
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-primary)]">TikTok</p>
              <p className="text-sm text-[var(--text-tertiary)]">@padelibre</p>
            </div>
          </a>

          <a
            href="https://wa.me/5493413741000?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20PadeLibre"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] transition active:scale-[0.98]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#25D366]">
              <MessageCircle size={22} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-[var(--text-primary)]">WhatsApp</p>
              <p className="text-sm text-[var(--text-tertiary)]">Escribinos directo</p>
            </div>
          </a>
        </div>
      </section>

      <p className="pb-4 text-center text-xs text-[var(--text-tertiary)]">Hecho con ❤️ en Argentina 🇦🇷</p>
    </MotionPage>
  );
}
