"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ProfileAvatar } from "@/components/profile-avatar";
import { PLAYER_CARD_INTERACTIVE, PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";

export type MatchCardData = {
  id: string;
  date: string;
  owner_id: string | null;
  is_competitive: boolean;
  level_restricted: boolean;
  gender_category: "masculino" | "femenino" | "mixto";
  clubName: string;
  clubLocation: string;
  clubCity: string;
  clubProvince: string;
  playersCount: number;
  freeSlots: number;
  currentUserJoined: boolean;
  userCanJoinByGender: boolean;
  genderRestrictionMessage: string | null;
  levelLabel: string;
  levelCategory: string;
  levelDescription: string;
  participants: Array<{
    player_id: string;
    team?: number | null;
    name: string;
    avatar_url: string | null;
    nivelCategory: string;
    nivelDescription: string;
  }>;
  team1Count: number;
  team2Count: number;
};

type Props = {
  matches: MatchCardData[];
  userId: string | null;
  userCity: string;
  userProvince: string;
};

type StatusFilter = "todos" | "amistoso" | "competitivo" | "con_lugar";
type GenderFilter = "todos" | "masculino" | "femenino" | "mixto";
type CityFilter = "mi_ciudad" | "mi_provincia" | "todas";

const chip = (active: boolean) =>
  active
    ? "rounded-full bg-[color:var(--color-brand-mid)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
    : "rounded-full border border-slate-200 bg-slate-100/80 px-3 py-1.5 text-xs font-semibold text-slate-600";

export default function MatchesFilterBoard({ matches, userId, userCity, userProvince }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("todos");
  const [cityFilter, setCityFilter] = useState<CityFilter>("mi_ciudad");

  const filtered = matches.filter((m) => {
    if (statusFilter === "amistoso" && m.is_competitive) return false;
    if (statusFilter === "competitivo" && !m.is_competitive) return false;
    if (statusFilter === "con_lugar" && m.freeSlots <= 0) return false;
    if (genderFilter !== "todos" && m.gender_category !== genderFilter) return false;
    if (cityFilter === "mi_ciudad" && m.clubCity !== userCity) return false;
    if (cityFilter === "mi_provincia" && m.clubProvince.trim().toLowerCase() !== userProvince.trim().toLowerCase()) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button type="button" onClick={() => setCityFilter("mi_ciudad")} className={chip(cityFilter === "mi_ciudad")}>
            Mi ciudad
          </button>
          <button type="button" onClick={() => setCityFilter("mi_provincia")} className={chip(cityFilter === "mi_provincia")}>
            Mi provincia
          </button>
          <button type="button" onClick={() => setCityFilter("todas")} className={chip(cityFilter === "todas")}>
            Todas
          </button>
        </div>
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
          const genderBadgeClass =
            match.gender_category === "masculino"
              ? "border-[var(--color-brand)]/35 bg-[var(--color-brand-light)] text-[var(--color-brand-dark)]"
              : match.gender_category === "femenino"
                ? "border-[#ec4899]/35 bg-[#ec4899]/10 text-[#be185d]"
                : "border-[#8b5cf6]/35 bg-[#8b5cf6]/10 text-[#6d28d9]";
          const topBarColor = match.is_competitive ? "bg-[var(--color-brand)]" : "bg-[#16a34a]";

            return (
            <motion.article
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              key={match.id}
              className={`${PLAYER_CARD_INTERACTIVE} relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 pt-6 shadow-[0_2px_16px_-4px_rgba(10,22,40,0.08)]`}
            >
              <div className={`absolute left-0 right-0 top-0 h-1.5 ${topBarColor}`} aria-hidden />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="truncate text-xl font-semibold leading-tight tracking-tight text-slate-900">
                    {match.clubName}
                  </h2>
                  <p className="truncate text-sm text-slate-500">{match.clubLocation}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${genderBadgeClass}`}
                  >
                    {categoryLabel}
                  </span>
                  {match.is_competitive ? (
                    <span className="shrink-0 rounded-full border border-[var(--color-brand)]/20 bg-[var(--color-brand-light)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-dark)]">
                      Partido competitivo
                    </span>
                  ) : null}
                  {match.level_restricted ? (
                    <span className="shrink-0 rounded-full border border-[var(--color-brand)]/20 bg-[var(--color-brand-light)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-dark)]">
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
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-slate-800">Cupos:</span>
                  <div
                    className="flex items-center gap-1.5"
                    role="img"
                    aria-label={`${match.playersCount} jugadores anotados, ${match.freeSlots} cupos libres de 4`}
                  >
                    {Array.from({ length: 4 }, (_, i) => {
                      const filled = i < match.playersCount;
                      return (
                        <span
                          key={i}
                          className={
                            filled
                              ? "h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-brand)]"
                              : "h-2.5 w-2.5 shrink-0 rounded-full border-2 border-slate-300 bg-transparent dark:border-slate-500"
                          }
                        />
                      );
                    })}
                  </div>
                  <span className="text-xs text-slate-500">
                    {match.freeSlots} libre{match.freeSlots === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Equipos: {match.team1Count}/2 · {match.team2Count}/2
                </p>
              </div>

              {match.participants.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                  {match.participants.map((mp) => (
                    <li key={mp.player_id}>
                      <Link
                        href={`/jugador/${mp.player_id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-[#0461C4] hover:text-[#0085FC]"
                      >
                        <ProfileAvatar
                          avatarUrl={mp.avatar_url}
                          name={mp.name}
                          size={24}
                          ringClassName="ring-1 ring-white"
                        />
                        <span className="flex flex-col leading-tight">
                          <span>{mp.name}</span>
                          <span className="text-[10px] font-medium text-[#0085FC]/90">
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
                  userId === match.owner_id ? (
                    <Link
                      href={`/partidos/${match.id}`}
                      className={`${PLAYER_PRIMARY_BUTTON} inline-flex items-center justify-center rounded-[2rem] px-4 py-2 text-sm`}
                    >
                      Mi partido
                    </Link>
                  ) : match.currentUserJoined ? (
                    <Link
                      href={`/partidos/${match.id}`}
                      className={`${PLAYER_PRIMARY_BUTTON} inline-flex items-center justify-center rounded-[2rem] px-4 py-2 text-sm`}
                    >
                      Ver partido
                    </Link>
                  ) : match.freeSlots > 0 && !match.genderRestrictionMessage ? (
                    <Link
                      href={`/partidos/${match.id}`}
                      className={`${PLAYER_PRIMARY_BUTTON} inline-flex items-center justify-center rounded-[2rem] px-4 py-2 text-sm`}
                    >
                      Pagar y unirse
                    </Link>
                  ) : match.genderRestrictionMessage ? (
                    <span className="rounded-[2rem] border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500">
                      Solo {categoryLabel}
                    </span>
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
