"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function LandingNav({ active }: { active: "home" | "clubes" }) {
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "Para jugadores", key: "home" as const },
    { href: "/para-clubes", label: "Para clubes", key: "clubes" as const },
  ];

  return (
    <nav
      className="sticky top-0 z-40 border-b border-white/10"
      style={{ background: "linear-gradient(120deg, #0085FC 0%, #0461C4 100%)" }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="PadeLibre" width={32} height={32} className="rounded-xl" />
          <span className="text-base font-bold text-white">PadeLibre</span>
        </Link>

        <div className="hidden items-center gap-6 sm:flex">
          {links.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className={`text-sm font-semibold transition ${
                active === l.key ? "text-[#CCFF00]" : "text-white/80 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="rounded-xl bg-white px-4 py-1.5 text-sm font-bold text-[#0461C4] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
          >
            Iniciar sesión
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 text-white sm:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 px-4 pb-4 pt-2 sm:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.key}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
                  active === l.key ? "bg-white/10 text-[#CCFF00]" : "text-white/85"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-lg bg-white px-3 py-2.5 text-center text-sm font-bold text-[#0461C4]"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
