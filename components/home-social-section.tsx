"use client";

import { motion } from "framer-motion";

const networks = [
  {
    platform: "Instagram",
    handle: "@padelibre_",
    href: "https://instagram.com/padelibre_",
    tagline: "Jugadas, memes y sorteos",
    accent: "from-[#F58529]/12 via-[#DD2A7B]/8 to-[#8134AF]/12",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="currentColor" fillRule="evenodd" clipRule="evenodd">
        <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.74 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    platform: "TikTok",
    handle: "@padelibre",
    href: "https://www.tiktok.com/@padelibre",
    tagline: "Tips, clips y novedades",
    accent: "from-[#25F4EE]/12 via-transparent to-[#FE2C55]/12",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
      </svg>
    ),
  },
] as const;

export function HomeSocialSection() {
  return (
    <motion.section
      className="space-y-3"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0585FC]">Comunidad</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Seguinos en redes</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Enterate de sorteos, memes de pádel y las últimas novedades de la app.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {networks.map((network, idx) => (
          <motion.a
            key={network.platform}
            href={network.href}
            target="_blank"
            rel="noreferrer"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.35, delay: idx * 0.08 }}
            whileTap={{ scale: 0.97 }}
            className="group relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3.5 shadow-[var(--shadow-card)]"
          >
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${network.accent} opacity-90 transition-opacity group-active:opacity-100`}
            />
            <div className="relative flex h-full flex-col">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] text-[var(--text-primary)]">
                {network.icon}
              </div>
              <p className="mt-3 text-xs font-bold text-[var(--text-primary)]">{network.platform}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-tertiary)]">{network.tagline}</p>
              <p className="mt-2 text-xs font-extrabold text-[#0585FC]">{network.handle}</p>
            </div>
          </motion.a>
        ))}
      </div>
    </motion.section>
  );
}
