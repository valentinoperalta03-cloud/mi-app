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
  level_restricted: boolean;
  gender_category: "masculino" | "femenino" | "mixto";
  clubName: string;
  clubLocation: string;
  clubCity: string;
  clubProvince: string;
  categoryRange: string[] | null;
  playersCount: number;
  freeSlots: number;
  currentUserJoined: boolean;
  userCanJoinByGender: boolean;
  genderRestrictionMessage: string | null;
  participants: Array<{
    player_id: string;
    team?: number | null;
    name: string;
    avatar_url: string | null;
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

type CuposFilter = "todos" | "con_lugar";
type GenderFilter = "todos" | "masculino" | "femenino" | "mixto";
type CityFilter = "mi_ciudad" | "mi_provincia" | "todas";

const CATEGORIES = ["8va", "7ma", "6ta", "5ta", "4ta", "3ra", "2da", "1ra"];

function normalizeForCompare(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

const chip = (active: boolean) =>
  active
    ? "rounded-full bg-[#0085FC] px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
    : "rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]";

export default function MatchesFilterBoard({ matches, userId, userCity, userProvince }: Props) {
  const [cuposFilter, setCuposFilter] = useState<CuposFilter>("con_lugar");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("todos");
  const [cityFilter, setCityFilter] = useState<CityFilter>("mi_ciudad");
  const [categoryFilter, setCategoryFilter] = useState("");

  const filtered = matches.filter((m) => {
    if (cuposFilter === "con_lugar" && m.freeSlots <= 0) return false;
    if (genderFilter !== "todos" && m.gender_category !== genderFilter) return false;
    if (cityFilter === "mi_ciudad" && normalizeForCompare(m.clubCity) !== normalizeForCompare(userCity)) return false;
    if (cityFilter === "mi_provincia" && normalizeForCompare(m.clubProvince) !== normalizeForCompare(userProvince)) return false;
    if (categoryFilter && m.categoryRange && m.categoryRange.length > 0) {
      if (!m.categoryRange.includes(categoryFilter)) return false;
    }
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
          <button type="button" onClick={() => setCuposFilter("todos")} className={chip(cuposFilter === "todos")}>
            Todos
          </button>
          <button type="button" onClick={() => setCuposFilter("con_lugar")} className={chip(cuposFilter === "con_lugar")}>
            Con lugar libre
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(["todos", "masculino", "femenino", "mixto"] as GenderFilter[]).map((f) => (
            <button key={f} type="button" onClick={() => setGenderFilter(f)} className={chip(genderFilter === f)}>
              {f === "todos" ? "Todos" : f === "masculino" ? "Masculino" : f === "femenino" ? "Femenino" : "Mixto"}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button type="button" onClick={() => setCategoryFilter("")} className={chip(!categoryFilter)}>
            Todas las categorías
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat === categoryFilter ? "" : cat)}
              className={chip(categoryFilter === cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm font-medium text-[var(--text-tertiary)]">
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

            return (
            <motion.article
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              key={match.id}
              className={`${PLAYER_CARD_INTERACTIVE} relative w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-[0_2px_16px_-4px_rgba(10,22,40,0.08)]`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="truncate text-xl font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
                    {match.clubName}
                  </h2>
                  <p className="truncate text-sm text-[var(--text-tertiary)]">{match.clubLocation}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${genderBadgeClass}`}
                  >
                    {categoryLabel}
                  </span>
                  {match.level_restricted ? (
                    <span className="shrink-0 rounded-full border border-[var(--color-brand)]/20 bg-[var(--color-brand-light)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-dark)]">
                      Nivel restringido 🎯
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-[var(--text-secondary)]">
                <p>
                  <span className="font-medium text-[var(--text-primary)]">Hora:</span> {when}
                </p>
                {match.categoryRange && match.categoryRange.length > 0 ? (
                  <p>
                    <span className="font-medium text-[var(--text-primary)]">Categorías: </span>
                    <span className="text-[var(--text-secondary)]">
                      {match.categoryRange.join(" · ")}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-[var(--text-tertiary)]">Cualquier categoría</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="flex gap-1"
                    role="img"
                    aria-label={`${match.playersCount} jugadores anotados, ${match.freeSlots} cupos libres de 4`}
                  >
                    {Array.from({ length: 4 }, (_, i) => (
                      <div
                        key={i}
                        className={`h-2 w-6 rounded-full transition ${
                          i < match.playersCount
                            ? "bg-[#0085FC]"
                            : "border border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    {match.playersCount}/4
                  </span>
                  {match.freeSlots > 0 ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {match.freeSlots} libre{match.freeSlots !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-tertiary)]">
                      Completo
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Equipos: {match.team1Count}/2 · {match.team2Count}/2
                </p>
              </div>

              {match.participants.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                  {match.participants.map((mp) => (
                    <li key={mp.player_id}>
                      <Link
                        href={`/jugador/${mp.player_id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-1 font-semibold text-[#0461C4] hover:text-[#0085FC]"
                      >
                        <ProfileAvatar
                          avatarUrl={mp.avatar_url}
                          name={mp.name}
                          size={24}
                          ringClassName="ring-1 ring-white"
                        />
                        <span>{mp.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4 flex items-center justify-between">
                <p className="min-w-0 text-xs text-[var(--text-tertiary)]">{match.playersCount} jugador(es) anotado(s)</p>

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
                      Unirse al partido
                    </Link>
                  ) : match.genderRestrictionMessage ? (
                    <span className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-tertiary)]">
                      Solo {categoryLabel}
                    </span>
                  ) : (
                    <span className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-tertiary)]">
                      Completo
                    </span>
                  )
                ) : match.freeSlots > 0 ? (
                  <span className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-tertiary)]">
                    Iniciá sesión
                  </span>
                ) : (
                  <span className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-tertiary)]">
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
        <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/80 px-4 py-5 text-center text-sm font-medium text-[var(--text-secondary)]">
          No encontramos partidos con esos filtros. ¡Proba con otros!
        </p>
      ) : null}
    </div>
  );
}
