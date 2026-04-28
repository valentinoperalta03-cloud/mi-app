"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { setUserFavorite } from "@/app/(player)/jugador/[userId]/actions";
import { formatProfileNivelFromRow, splitOfficialCategoryLine } from "@/lib/profile-display";
import { AppleToast } from "@/components/apple-toast";

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
  players: PlayerCard[];
  initialFollowingIds: string[];
  followsMeIds: string[];
};

export default function FriendsSearchClient({
  players,
  initialFollowingIds,
  followsMeIds,
}: FriendsSearchClientProps) {
  const [query, setQuery] = useState("");
  const [followingIds, setFollowingIds] = useState(() => new Set(initialFollowingIds));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      <header className="mb-6 space-y-3">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Jugadores</h1>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3.5 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jugadores..."
            className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-3 pl-9 pr-4 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[#0585FC] focus:ring-2 focus:ring-[#0585FC]/20"
          />
        </div>
      </header>

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
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={isPending && pendingId === player.user_id}
                      onClick={() => {
                        startTransition(async () => {
                          setPendingId(player.user_id);
                          const isFollowing = followingIds.has(player.user_id);
                          const next = !isFollowing;
                          const res = await setUserFavorite(player.user_id, next);
                          if (res.ok) {
                            setFollowingIds((prev) => {
                              const updated = new Set(prev);
                              if (next) {
                                updated.add(player.user_id);
                              } else {
                                updated.delete(player.user_id);
                              }
                              return updated;
                            });
                            setToast(next ? "¡Ahora seguís a este jugador!" : "Dejaste de seguir");
                          } else {
                            setToast(res.message);
                          }
                          setTimeout(() => setToast(null), 2400);
                          setPendingId(null);
                        });
                      }}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                        followingIds.has(player.user_id)
                          ? "border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                          : "bg-[#0585FC] text-white hover:bg-[#0461C4]"
                      }`}
                    >
                      {followingIds.has(player.user_id)
                        ? "Siguiendo"
                        : followsMeIds.includes(player.user_id)
                          ? "Seguir de vuelta"
                          : "Seguir"}
                    </button>
                    <Link
                      href={`/jugador/${player.user_id}`}
                      className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-center text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[#0585FC]/30 hover:text-[#0585FC]"
                    >
                      Ver perfil
                    </Link>
                  </div>
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
      <AppleToast message={toast} />
    </div>
  );
}
