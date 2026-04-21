"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Search, UserPlus, UserX } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { formatProfileNivelFromRow, splitOfficialCategoryLine } from "@/lib/profile-display";
import { createClient } from "@/utils/supabase/client";

type PlayerCard = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  level?: number | null;
  level_of_play?: string | null;
  technical_score?: number | null;
};

type FriendsSearchClientProps = {
  currentUserId: string;
  players: PlayerCard[];
  initialFriendIds: string[];
};

export default function FriendsSearchClient({
  currentUserId,
  players,
  initialFriendIds,
}: FriendsSearchClientProps) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set(initialFriendIds));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((player) => {
      const label = (player.name ?? "Jugador").toLowerCase();
      const nivelLine = formatProfileNivelFromRow(player).toLowerCase();
      return label.includes(q) || nivelLine.includes(q);
    });
  }, [players, query]);

  const myFriends = useMemo(
    () => players.filter((player) => friendIds.has(player.user_id)),
    [players, friendIds]
  );

  async function toggleFriend(targetId: string) {
    if (pendingId) return;
    setErrorText(null);
    const wasFriend = friendIds.has(targetId);

    setPendingId(targetId);
    setFriendIds((prev) => {
      const next = new Set(prev);
      if (wasFriend) next.delete(targetId);
      else next.add(targetId);
      return next;
    });

    if (wasFriend) {
      const { error } = await supabase
        .from("user_favorites")
        .delete()
        .eq("user_id", currentUserId)
        .eq("favorite_user_id", targetId);
      if (error) {
        setErrorText("No se pudo eliminar el amigo. Intentá nuevamente.");
        setFriendIds((prev) => {
          const next = new Set(prev);
          next.add(targetId);
          return next;
        });
      }
    } else {
      const { error } = await supabase.from("user_favorites").insert({
        user_id: currentUserId,
        favorite_user_id: targetId,
      });
      if (error) {
        setErrorText("No se pudo agregar el amigo. Intentá nuevamente.");
        setFriendIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      }
    }

    setPendingId(null);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="relative h-7 w-24 overflow-hidden opacity-75">
          <Image src="/logo-marca.png" alt="Padelibre" fill className="object-contain" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sistema de amigos</h1>
        <p className="text-sm text-slate-500">Buscá jugadores por nombre o nivel y conectá en segundos.</p>
      </header>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <label htmlFor="buscar-amigos" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Buscar jugador
        </label>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <Search size={16} className="text-slate-400" />
          <input
            id="buscar-amigos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej: Juan, 4ta, 5ta..."
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
        </div>
      </section>

      {errorText ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {errorText}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Resultados</h2>
        <ul className="space-y-3">
          {filtered.map((player) => {
            const label = player.name?.trim() || "Jugador";
            const isFriend = friendIds.has(player.user_id);
            const nivelParts = splitOfficialCategoryLine(formatProfileNivelFromRow(player));
            return (
              <li key={player.user_id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <ProfileAvatar avatarUrl={player.avatar_url} name={label} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
                    <span className="mt-1 inline-flex rounded-full border border-[#0585FC]/20 bg-[#0585FC]/5 px-2.5 py-1 text-[11px] font-semibold text-[#0461C4]">
                      {nivelParts.category || "Sin nivel"}
                    </span>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    disabled={pendingId === player.user_id}
                    onClick={() => void toggleFriend(player.user_id)}
                    className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                      isFriend
                        ? "border border-rose-200 bg-rose-50 text-rose-700"
                        : "bg-[color:var(--color-brand-mid)] text-white"
                    } disabled:opacity-60`}
                  >
                    {isFriend ? <UserX size={14} /> : <UserPlus size={14} />}
                    {isFriend ? "Eliminar amigo" : "Agregar amigo"}
                  </motion.button>
                </div>
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-500">
            No encontramos jugadores con esa búsqueda.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Mis amigos</h2>
        {myFriends.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-500">
            Aún no agregaste amigos.
          </p>
        ) : (
          <ul className="space-y-2">
            {myFriends.map((friend) => {
              const label = friend.name?.trim() || "Jugador";
              return (
                <li
                  key={`friend-${friend.user_id}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm"
                >
                  <ProfileAvatar avatarUrl={friend.avatar_url} name={label} size={40} />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{label}</p>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/jugador/${friend.user_id}`}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Ver perfil
                    </Link>
                    <Link
                      href={`/comunidad/mensajes/${friend.user_id}`}
                      className="inline-flex items-center gap-1 rounded-xl bg-[color:var(--color-brand-mid)] px-2.5 py-1.5 text-xs font-semibold text-white"
                    >
                      <MessageSquare size={12} />
                      Mensaje
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
