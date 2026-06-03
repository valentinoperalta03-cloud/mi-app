"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import Link from "next/link";
import { Trophy } from "lucide-react";
import type { ProfileMatchCard } from "@/lib/profile-insights";

type ProfileMatchCardsPremiumProps = {
  cards: ProfileMatchCard[];
  showViewAll?: boolean;
};

export function ProfileMatchCardsPremium({
  cards,
  showViewAll = true,
}: ProfileMatchCardsPremiumProps) {
  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0585FC]/12">
          <Trophy className="h-6 w-6 text-[#0585FC]" strokeWidth={1.75} aria-hidden />
        </div>
        <h3 className="mt-4 text-base font-bold text-[var(--text-primary)]">Todavía no jugaste partidos</h3>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Cuando termines tu primer partido, verás tus resultados acá
        </p>
        <Link
          href="/buscar-partido"
          className="btn-primary-gradient mt-5 inline-flex w-full max-w-[240px] items-center justify-center rounded-2xl py-3 text-sm font-semibold transition hover:brightness-95 active:scale-[0.99]"
        >
          Buscar partido
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.map((c, i) => (
        <motion.div
          key={c.matchId}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href={`/partidos/${c.matchId}`}
            className="block rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3.5 transition hover:border-[var(--border-default)] hover:bg-[var(--bg-card)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">{c.clubName}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--text-tertiary)]">{c.courtName}</p>
              </div>
              {c.scoreLabel ? (
                <span className="shrink-0 rounded-full bg-[var(--bg-card)] px-2.5 py-1 text-xs font-semibold tabular-nums text-[#0461C4] shadow-sm ring-1 ring-[var(--border-subtle)]">
                  {c.scoreLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
              {format(new Date(c.whenIso), "d MMM yyyy", { locale: es })}
            </p>
          </Link>
        </motion.div>
      ))}
      {showViewAll ? (
        <Link
          href="/perfil/partidos"
          className="mt-1 inline-flex items-center justify-center rounded-2xl border border-[var(--border-subtle)] py-3 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)]"
        >
          Ver todos
        </Link>
      ) : null}
    </div>
  );
}
