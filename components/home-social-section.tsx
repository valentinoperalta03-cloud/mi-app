"use client";

import { motion } from "framer-motion";

const networks = [
  {
    platform: "Instagram",
    handle: "@padelibre_",
    href: "https://instagram.com/padelibre_",
    tagline: "Jugadas, memes y sorteos",
    accent: "from-[#F58529]/12 via-[#DD2A7B]/8 to-[#8134AF]/12",
    iconBg: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.17.054 1.97.24 2.427.403a4.92 4.92 0 0 1 1.77 1.153 4.92 4.92 0 0 1 1.153 1.77c.163.457.349 1.257.403 2.427.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.054 1.17-.24 1.97-.403 2.427a4.92 4.92 0 0 1-1.153 1.77 4.92 4.92 0 0 1-1.77 1.153c-.457.163-1.257.349-2.427.403-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.17-.054-1.97-.24-2.427-.403a4.92 4.92 0 0 1-1.77-1.153 4.92 4.92 0 0 1-1.153-1.77c-.163-.457-.349-1.257-.403-2.427C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.054-1.17.24-1.97.403-2.427a4.92 4.92 0 0 1 1.153-1.77 4.92 4.92 0 0 1 1.77-1.153c.457-.163 1.257-.349 2.427-.403C8.416 2.175 8.796 2.163 12 2.163zm0 1.622c-3.15 0-3.516.012-4.75.069-1.02.047-1.574.218-1.942.363-.49.19-.84.417-1.208.785-.368.368-.595.718-.785 1.208-.145.368-.316.922-.363 1.942-.057 1.234-.069 1.6-.069 4.75s.012 3.516.069 4.75c.047 1.02.218 1.574.363 1.942.19.49.417.84.785 1.208.368.368.718.595 1.208.785.368.145.922.316 1.942.363 1.234.057 1.6.069 4.75.069s3.516-.012 4.75-.069c1.02-.047 1.574-.218 1.942-.363.49-.19.84-.417 1.208-.785.368-.368.595-.718.785-1.208.145-.368.316-.922.363-1.942.057-1.234.069-1.6.069-4.75s-.012-3.516-.069-4.75c-.047-1.02-.218-1.574-.363-1.942a3.14 3.14 0 0 0-.785-1.208 3.14 3.14 0 0 0-1.208-.785c-.368-.145-.922-.316-1.942-.363-1.234-.057-1.6-.069-4.75-.069zm0 3.351a5.864 5.864 0 1 1 0 11.728 5.864 5.864 0 0 1 0-11.728zm0 1.622a4.242 4.242 0 1 0 0 8.484 4.242 4.242 0 0 0 0-8.484zm6.406-4.845a1.37 1.37 0 1 1-2.74 0 1.37 1.37 0 0 1 2.74 0z" />
      </svg>
    ),
  },
  {
    platform: "TikTok",
    handle: "@padelibre",
    href: "https://www.tiktok.com/@padelibre",
    tagline: "Tips, clips y novedades",
    accent: "from-[#25F4EE]/12 via-transparent to-[#FE2C55]/12",
    iconBg: "#000000",
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
        <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">Seguinos en redes</h2>
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
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                style={{ background: network.iconBg }}
              >
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
