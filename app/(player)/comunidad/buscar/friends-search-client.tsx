"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { formatProfileNivelFromRow, splitOfficialCategoryLine } from "@/lib/profile-display";

type PlayerCard = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  category?: string | null;
  level?: number | null;
  level_of_play?: string | null;
  technical_score?: number | null;
};

type FriendsSearchClientProps = {
  currentUserId: string;
  players: PlayerCard[];
};

export default function FriendsSearchClient({
  players,
}: FriendsSearchClientProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return players;
    return players.filter((player) => {
      const label = (player.name ?? "Jugador").toLowerCase();
      const nivelLine = formatProfileNivelFromRow(player).toLowerCase();
      const bio = (player.bio ?? "").toLowerCase();
      return label.includes(q) || nivelLine.includes(q);
    }).filter((player) => {
      const label = (player.name ?? "Jugador").toLowerCase();
      const nivelLine = formatProfileNivelFromRow(player).toLowerCase();
      const bio = (player.bio ?? "").toLowerCase();
      return label.includes(q) || nivelLine.includes(q) || bio.includes(q);
    });
  }, [players, query]);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="relative h-7 w-24 overflow-hidden opacity-75">
          <Image src="/logo-marca.png" alt="Padelibre" fill className="object-contain" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Encontrar amigos</h1>
        <p className="text-sm text-[var(--text-tertiary)]">Buscá jugadores por nombre o nivel y conectá en segundos.</p>
      </header>

      <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-sm">
        <label htmlFor="buscar-amigos" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          Buscar jugador
        </label>
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2.5">
          <Search size={16} className="text-[var(--text-tertiary)]" />
          <input
            id="buscar-amigos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej: Juan, 4ta, 5ta..."
            className="w-full bg-transparent text-sm text-[var(--text-secondary)] outline-none placeholder:text-[var(--text-tertiary)]"
          />
        </div>
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          Escribí al menos 2 caracteres para filtrar resultados.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
          Resultados ({filtered.length})
        </h2>
        <ul className="space-y-3">
          {filtered.map((player) => {
            const label = player.name?.trim() || "Jugador";
            const nivelParts = splitOfficialCategoryLine(formatProfileNivelFromRow(player));
            return (
              <li key={player.user_id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <ProfileAvatar avatarUrl={player.avatar_url} name={label} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{label}</p>
                    <span className="mt-1 inline-flex rounded-full border border-[#0585FC]/20 bg-[#0585FC]/5 px-2.5 py-1 text-[11px] font-semibold text-[#0461C4]">
                      {player.category ? `Nivel ${player.category}` : nivelParts.category || "Sin nivel"}
                    </span>
                    {player.bio?.trim() ? (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--text-tertiary)]">{player.bio.trim()}</p>
                    ) : null}
                  </div>
                  <Link
                    href={`/jugador/${player.user_id}`}
                    className="rounded-xl bg-[#0585FC] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0461C4]"
                  >
                    Ver perfil
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-5 text-center text-sm text-[var(--text-tertiary)]">
            No encontramos jugadores con esa búsqueda.
          </p>
        ) : null}
      </section>

    </div>
  );
}
