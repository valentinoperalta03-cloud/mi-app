"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import type { ComunidadPlayerRow } from "@/lib/comunidad-players-data";

const CATEGORIES = ["8va", "7ma", "6ta", "5ta", "4ta", "3ra", "2da", "1ra"];

type JugadoresClientProps = {
  players: ComunidadPlayerRow[];
  initialFollowingIds: string[];
  followsMeIds: string[];
  currentUserId: string;
};

export default function JugadoresClient({
  players,
  initialFollowingIds,
  followsMeIds,
}: JugadoresClientProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  const cities = useMemo(
    () =>
      [...new Set(players.map((p) => p.city?.trim()).filter(Boolean) as string[])].sort(),
    [players]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (q && !p.name?.toLowerCase().includes(q)) return false;
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (cityFilter && p.city?.trim().toLowerCase() !== cityFilter.toLowerCase()) return false;
      return true;
    });
  }, [players, search, categoryFilter, cityFilter]);

  const grouped = useMemo(() => {
    return CATEGORIES.reduce((acc, cat) => {
      const inCat = filtered.filter((p) => p.category === cat);
      if (inCat.length > 0) acc[cat] = inCat;
      return acc;
    }, {} as Record<string, ComunidadPlayerRow[]>);
  }, [filtered]);

  const sinCategoria = useMemo(
    () => filtered.filter((p) => !p.category?.trim()),
    [filtered]
  );

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setCityFilter("");
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3">
        <input
          type="search"
          placeholder="Buscar jugador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[#0085FC] focus:outline-none focus:ring-2 focus:ring-[#0085FC]/20"
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategoryFilter("")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              !categoryFilter
                ? "bg-[#0085FC] text-white"
                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
            }`}
          >
            Todas
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat === categoryFilter ? "" : cat)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                categoryFilter === cat
                  ? "bg-[#0085FC] text-white"
                  : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {cities.length > 0 ? (
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-2.5 text-sm text-[var(--text-primary)]"
          >
            <option value="">Todas las ciudades</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <p className="mb-4 text-sm text-[var(--text-tertiary)]">
        {filtered.length} jugador{filtered.length !== 1 ? "es" : ""}
        {categoryFilter ? ` en categoría ${categoryFilter}` : ""}
        {cityFilter ? ` en ${cityFilter}` : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-8 text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            No hay jugadores con esos filtros
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-2 text-sm font-semibold text-[#0085FC]"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <>
          {CATEGORIES.filter((cat) => grouped[cat]).map((cat) => (
            <section key={cat} className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest"
                  style={{ background: "#CCFF00", color: "#000" }}
                >
                  {cat}
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {grouped[cat].length} jugador{grouped[cat].length !== 1 ? "es" : ""}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {grouped[cat].map((player) => (
                  <PlayerCard
                    key={player.user_id}
                    player={player}
                    isFollowing={initialFollowingIds.includes(player.user_id)}
                    followsMe={followsMeIds.includes(player.user_id)}
                  />
                ))}
              </div>
            </section>
          ))}

          {sinCategoria.length > 0 && !categoryFilter ? (
            <section className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-tertiary)]">
                  Sin categoría
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {sinCategoria.length} jugador{sinCategoria.length !== 1 ? "es" : ""}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {sinCategoria.map((player) => (
                  <PlayerCard
                    key={player.user_id}
                    player={player}
                    isFollowing={initialFollowingIds.includes(player.user_id)}
                    followsMe={followsMeIds.includes(player.user_id)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function PlayerCard({
  player,
  isFollowing,
  followsMe,
}: {
  player: ComunidadPlayerRow;
  isFollowing: boolean;
  followsMe: boolean;
}) {
  return (
    <Link
      href={`/jugador/${player.user_id}`}
      className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 transition hover:bg-[var(--bg-card-hover)] active:scale-[0.99]"
    >
      <ProfileAvatar avatarUrl={player.avatar_url} name={player.name ?? "J"} size={44} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
          {player.name ?? "Jugador"}
        </p>
        {player.city ? (
          <p className="truncate text-xs text-[var(--text-tertiary)]">📍 {player.city}</p>
        ) : null}
      </div>

      {isFollowing && followsMe ? (
        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          Amigos
        </span>
      ) : followsMe ? (
        <span className="shrink-0 rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-tertiary)]">
          Te sigue
        </span>
      ) : null}

      <ChevronRight size={16} className="shrink-0 text-[var(--text-tertiary)]" />
    </Link>
  );
}
