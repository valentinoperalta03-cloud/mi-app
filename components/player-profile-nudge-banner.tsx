"use client";

import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISS_KEY = "padelibre:profile-nudge-dismissed";

export default function PlayerProfileNudgeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(sessionStorage.getItem(DISMISS_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <Link
      href="/onboarding"
      className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg-subtle)] px-4 py-2.5 text-sm transition active:scale-[0.99]"
    >
      <span className="min-w-0 truncate text-[var(--text-secondary)]">Completá tu perfil para una mejor experiencia</span>
      <span className="flex shrink-0 items-center gap-0.5">
        <ChevronRight size={16} className="text-[var(--text-tertiary)]" aria-hidden />
        <button
          type="button"
          aria-label="Cerrar"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // sessionStorage no disponible — el banner simplemente se cierra para este render
            }
            setVisible(false);
          }}
          className="rounded-full p-1 text-[var(--text-tertiary)] transition hover:bg-black/5 dark:hover:bg-white/5"
        >
          <X size={14} aria-hidden />
        </button>
      </span>
    </Link>
  );
}
