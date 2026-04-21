"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import Link from "next/link";
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
      <p className="text-sm text-slate-400">
        Aún no hay partidos con resultado en tu historial.
      </p>
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
            href={`/matches/${c.matchId}`}
            className="block rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3.5 transition hover:border-slate-200 hover:bg-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{c.clubName}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{c.courtName}</p>
              </div>
              {c.scoreLabel ? (
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-[#0461C4] shadow-sm ring-1 ring-slate-100">
                  {c.scoreLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {format(new Date(c.whenIso), "d MMM yyyy", { locale: es })}
            </p>
          </Link>
        </motion.div>
      ))}
      {showViewAll ? (
        <Link
          href="/perfil/partidos"
          className="mt-1 inline-flex items-center justify-center rounded-2xl border border-slate-200/80 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Ver todos
        </Link>
      ) : null}
    </div>
  );
}
