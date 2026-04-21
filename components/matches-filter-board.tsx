"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import JoinToggleButton from "@/app/(player)/buscar-partido/join-toggle-button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { PLAYER_CARD_INTERACTIVE } from "@/lib/player-ui";

export type MatchCardData = {
  id: string;
  date: string;
  owner_id: string | null;
  is_competitive: boolean;
  level_restricted: boolean;
  gender_category: "masculino" | "femenino" | "mixto";
  clubName: string;
  clubLocation: string;
  playersCount: number;
  freeSlots: number;
  joinShare: number;
  requiresPaymentToJoin: boolean;
  currentUserJoined: boolean;
  userCanJoinByGender: boolean;
  genderRestrictionMessage: string | null;
  levelLabel: string;
  levelCategory: string;
  levelDescription: string;
  participants: Array<{
    player_id: string;
    name: string;
    avatar_url: string | null;
    nivelCategory: string;
    nivelDescription: string;
  }>;
};

type Props = {
  matches: MatchCardData[];
  userId: string | null;
};

type StatusFilter = "todos" | "amistoso" | "competitivo" | "con_lugar";
type GenderFilter = "todos" | "masculino" | "femenino" | "mixto";

const chip = (active: boolean) =>
  active
    ? "rounded-full bg-[color:var(--color-brand-mid)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
    : "rounded-full border border-slate-200 bg-slate-100/80 px-3 py-1.5 text-xs font-semibold text-slate-600";

export default function MatchesFilterBoard({ matches, userId }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("todos");

  const filtered = matches.filter((m) => {
    if (statusFilter === "amistoso" && m.is_competitive) return false;
    if (statusFilter === "competitivo" && !m.is_competitive) return false;
    if (statusFilter === "con_lugar" && m.freeSlots <= 0) return false;
    if (genderFilter !== "todos" && m.gender_category !== genderFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(["todos", "amistoso", "competitivo", "con_lugar"] as StatusFilter[]).map((f) => (
            <button key={f} type="button" onClick={() => setStatusFilter(f)} className={chip(statusFilter === f)}>
              {f === "todos"
                ? "Todos"
                : f === "amistoso"
                  ? "Amistoso"
                  : f === "competitivo"
                    ? "Competitivo"
                    : "Con lugar"}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(["todos", "masculino", "femenino", "mixto"] as GenderFilter[]).map((f) => (
            <button key={f} type="button" onClick={() => setGenderFilter(f)} className={chip(genderFilter === f)}>
              {f === "todos" ? "Todos" : f === "masculino" ? "Masculino" : f === "femenino" ? "Femenino" : "Mixto"}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm font-medium text-slate-500">
        {filtered.length} {filtered.length === 1 ? "partido disponible" : "partidos disponibles"}
      </p>

      <motion.div layout className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((match) => {
          const when = format(parseISO(match.date), "EEE d MMM · HH:mm", { locale: es });
          const categoryLabel =
            match.gender_category === "masculino"
              ? "Masculino"
              : match.gender_category === "femenino"
                ? "Femenino"
                : "Mixto";

            return (
            <motion.article
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              key={match.id}
              className={`${PLAYER_CARD_INTERACTIVE} relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_16px_-4px_rgba(10,22,40,0.08)] ${
                match.is_competitive ? "border-t-2 border-t-sky-500" : "border-t-2 border-t-emerald-400"
              }`}
            >
              <div className="absolute right-3 top-3 opacity-5">
                <svg width="32" height="32" viewBox="0 0 32 32" className="text-[#0585FC]">
                  <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M5 12 Q16 10 27 12" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M5 16 Q16 14 27 16" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M5 20 Q16 18 27 20" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="truncate text-xl font-semibold leading-tight tracking-tight text-slate-900">
                    {match.clubName}
                  </h2>
                  <p className="truncate text-sm text-slate-500">{match.clubLocation}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {categoryLabel}
                  </span>
                  {match.is_competitive ? (
                    <span className="shrink-0 rounded-full border border-[#0585FC]/20 bg-[#0585FC]/5 px-3 py-1 text-xs font-semibold text-[#0461C4]">
                      Partido competitivo
                    </span>
                  ) : null}
                  {match.level_restricted ? (
                    <span className="shrink-0 rounded-full border border-[#0585FC]/20 bg-[#0585FC]/5 px-3 py-1 text-xs font-semibold text-[#0461C4]">
                      Nivel restringido 🎯
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                <p>
                  <span className="font-medium text-slate-800">Hora:</span> {when}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Nivel promedio:</span>{" "}
                  <span className="text-[#0461C4]">
                    <span className="font-bold">{match.levelCategory || "—"}</span>
                    {match.levelDescription ? (
                      <span className="font-medium">{" - "}{match.levelDescription}</span>
                    ) : null}
                  </span>
                </p>
                {match.joinShare > 0 ? (
                  <p>
                    <span className="font-medium text-slate-800">💳 Costo para unirse:</span>{" "}
                    <span className="font-semibold text-[#0585FC]">${match.joinShare}</span>
                  </p>
                ) : null}
                <p>
                  <span className="font-medium text-slate-800">Cupos libres:</span> {match.freeSlots} / 4
                </p>
              </div>

              {match.participants.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                  {match.participants.map((mp) => (
                    <li key={mp.player_id}>
                      <Link
                        href={`/jugador/${mp.player_id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-[#0461C4] hover:text-[#0585FC]"
                      >
                        <ProfileAvatar
                          avatarUrl={mp.avatar_url}
                          name={mp.name}
                          size={24}
                          ringClassName="ring-1 ring-white"
                        />
                        <span className="flex flex-col leading-tight">
                          <span>{mp.name}</span>
                          <span className="text-[10px] font-medium text-[#0585FC]/90">
                            <span className="font-bold">{mp.nivelCategory || "—"}</span>
                            {mp.nivelDescription ? (
                              <span>{" - "}{mp.nivelDescription}</span>
                            ) : null}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4 flex items-center justify-between">
                <p className="min-w-0 text-xs text-slate-500">{match.playersCount} jugador(es) anotado(s)</p>

                {userId ? (
                  match.freeSlots > 0 || match.currentUserJoined ? (
                    <JoinToggleButton
                      matchId={match.id}
                      isJoined={match.currentUserJoined}
                      levelRestricted={match.level_restricted}
                      requiresPayment={match.requiresPaymentToJoin}
                      disabled={!match.currentUserJoined && !match.userCanJoinByGender}
                      disabledMessage={match.genderRestrictionMessage ?? undefined}
                    />
                  ) : (
                    <span className="rounded-[2rem] border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500">
                      Completo
                    </span>
                  )
                ) : match.freeSlots > 0 ? (
                  <span className="rounded-[2rem] border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500">
                    Iniciá sesión
                  </span>
                ) : (
                  <span className="rounded-[2rem] border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500">
                    Completo
                  </span>
                )}
              </div>
            </motion.article>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-5 text-center text-sm font-medium text-slate-600">
          No encontramos partidos con esos filtros. ¡Proba con otros!
        </p>
      ) : null}
    </div>
  );
}
