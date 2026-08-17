"use client";

import Link from "next/link";
import { MessageSquareDashed } from "lucide-react";
import { motion } from "framer-motion";
import { ProfileAvatar } from "@/components/profile-avatar";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { FeedItem, MatchFeedItem } from "@/lib/para-ti-posts";

export function ParaTiPostsMotion({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white dark:border-slate-800">
        <EmptyState
          icon={MessageSquareDashed}
          title="Todavía no hay publicaciones"
          description="Sé el primero en compartir algo con la comunidad."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item, i) => {
        if (item.type === "match") {
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <MatchCard match={item} />
            </motion.div>
          );
        }
        const p = item;
        const name = p.profiles?.name?.trim() || "Jugador";
        const postTypeLabel =
          p.post_type === "photo" ? "Foto" : p.post_type === "result" ? "Resultado" : "Texto";
        const accentBorder =
          p.post_type === "result"
            ? "border-l-[#f59e0b]"
            : p.post_type === "photo"
              ? "border-l-[#0085FC]"
              : "border-l-[#8b5cf6]";
        const badgeClass =
          p.post_type === "result"
            ? "border-amber-300/80 bg-gradient-to-r from-amber-50 to-amber-100/90 text-amber-900 shadow-sm dark:from-amber-950/50 dark:to-amber-900/30 dark:text-amber-200"
            : p.post_type === "photo"
              ? "border-[#0085FC]/30 bg-gradient-to-r from-[#0085FC]/12 to-sky-100/80 text-[#0461C4] shadow-sm dark:to-sky-950/40 dark:text-sky-200"
              : "border-violet-300/70 bg-gradient-to-r from-violet-50 to-violet-100/80 text-violet-900 shadow-sm dark:from-violet-950/40 dark:to-violet-900/25 dark:text-violet-200";

        return (
          <motion.article
            key={p.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={`rounded-[2.5rem] border border-slate-200/80 border-l-4 bg-white p-5 pl-6 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.16)] dark:border-slate-700/80 dark:bg-slate-900/40 ${accentBorder}`}
          >
            <div className="flex gap-3">
              <Link href={`/jugador/${p.user_id}`} className="shrink-0">
                <ProfileAvatar
                  avatarUrl={p.profiles?.avatar_url ?? null}
                  name={name}
                  size={48}
                  ringClassName="ring-2 ring-slate-100"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                  <Link
                    href={`/jugador/${p.user_id}`}
                    className="font-semibold text-slate-900 hover:text-[#0461C4]"
                  >
                    {name}
                  </Link>
                  <RelativeTime
                    iso={p.created_at}
                    className="text-[10px] font-normal tracking-wide text-slate-400/75 dark:text-slate-500"
                  />
                </div>
                <div className="mt-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${badgeClass}`}
                  >
                    {postTypeLabel}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {p.content}
                </p>
                {p.image_url && p.post_type === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- imagen pública servida desde storage
                  <img src={p.image_url} alt="Foto del post" className="mt-3 max-h-64 w-full rounded-2xl object-cover" />
                ) : null}
                {p.post_type === "result" && p.scoreLabel ? (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1.5 dark:bg-amber-950/30">
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-300">🏆 {p.scoreLabel}</span>
                  </div>
                ) : null}
                {p.post_type === "result" && !p.scoreLabel && p.match_id ? (
                  <Badge variant="brand" className="mt-3 inline-flex items-center">
                    <span className="mr-1.5" aria-hidden>
                      🏆
                    </span>
                    Partido vinculado
                  </Badge>
                ) : null}
              </div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}

function MatchCard({ match }: { match: MatchFeedItem }) {
  const genderLabel =
    match.genderCategory === "masculino" ? "Masculino" : match.genderCategory === "femenino" ? "Femenino" : "Mixto";

  return (
    <Link
      href={`/partidos/${match.id}`}
      className="block rounded-2xl border border-[#0085FC]/20 bg-[#0085FC]/[0.04] p-4 transition hover:bg-[#0085FC]/[0.08]"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="mb-1 text-[11px] font-mono uppercase tracking-widest text-[#0085FC]/70">
            Partido abierto
          </p>
          <p className="text-base font-bold text-[var(--text-primary)]">{match.clubName}</p>
          {match.courtName ? (
            <p className="text-xs text-[var(--text-tertiary)]">{match.courtName}</p>
          ) : null}
        </div>
        {match.freeSlots > 0 ? (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {match.freeSlots} lugar{match.freeSlots !== 1 ? "es" : ""} libre{match.freeSlots !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-tertiary)]">
            Completo
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
          📅 {match.scheduledDate} · {match.scheduledTime}hs
        </span>
        <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
          {genderLabel}
        </span>
        {match.categoryRange && match.categoryRange.length > 0 ? (
          <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            {match.categoryRange.join(" · ")}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 w-5 rounded-full ${
                i < match.playersCount
                  ? "bg-[#0085FC]"
                  : "border border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-[var(--text-tertiary)]">{match.playersCount}/4 jugadores</span>
      </div>
    </Link>
  );
}
