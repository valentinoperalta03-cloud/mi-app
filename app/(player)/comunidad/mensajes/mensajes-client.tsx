"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Info, Plus, X } from "lucide-react";
import { createGroupChatAction } from "@/app/(player)/comunidad/mensajes/actions";
import { ProfileAvatar } from "@/components/profile-avatar";
import type { ConversationPreview } from "@/lib/chat-partners";
import type { GroupPreview } from "@/lib/group-chats";

export function MensajesClient({
  conversations,
  groups,
  mutualIds,
  mutualFriends,
}: {
  conversations: ConversationPreview[];
  groups: GroupPreview[];
  mutualIds: string[];
  mutualFriends: Array<{ user_id: string; name: string | null; avatar_url: string | null }>;
}) {
  const [activeTab, setActiveTab] = useState<"directos" | "grupos">("directos");
  const [showInfo, setShowInfo] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const mutualSet = useMemo(() => new Set(mutualIds), [mutualIds]);

  function toggleMember(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <section className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Tus conversaciones</h2>
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-tertiary)] transition active:scale-95"
          aria-label="Cómo funcionan los mensajes"
        >
          <Info size={18} />
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setActiveTab("directos")}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
            activeTab === "directos" ? "bg-[#0585FC] text-white" : "text-slate-600"
          }`}
        >
          Directos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("grupos")}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
            activeTab === "grupos" ? "bg-[#0585FC] text-white" : "text-slate-600"
          }`}
        >
          Grupos
        </button>
      </div>

      {activeTab === "grupos" ? (
        <>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#0461C4] px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Nuevo grupo
          </button>
          <ul className="flex flex-col gap-3">
            {groups.map((g) => {
              const when =
                g.lastAt && new Date(g.lastAt).getTime() > 0
                  ? formatDistanceToNow(new Date(g.lastAt), { addSuffix: true, locale: es })
                  : null;
              return (
                <li key={g.id}>
                  <Link
                    href={`/comunidad/mensajes/grupo/${g.id}`}
                    className="block rounded-[2.2rem] border border-slate-200/80 bg-white p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.15)]"
                  >
                    <p className="font-semibold text-slate-900">{g.title}</p>
                    {g.description ? (
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500">{g.description}</p>
                    ) : null}
                    <p className="mt-2 line-clamp-1 text-sm text-slate-600">{g.lastMessage}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                      <span>{g.membersCount} miembros</span>
                      <span>{when}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {groups.length === 0 ? (
            <p className="rounded-[2.2rem] border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
              No tenés grupos todavía.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {conversations.map((c) => {
              const when =
                c.lastAt && new Date(c.lastAt).getTime() > 0
                  ? formatDistanceToNow(new Date(c.lastAt), { addSuffix: true, locale: es })
                  : null;
              return (
                <li key={c.peerId}>
                  <Link
                    href={`/comunidad/mensajes/${c.peerId}`}
                    className="flex items-center gap-4 rounded-[2.5rem] border border-slate-200/80 bg-white p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.15)] transition hover:border-slate-300/90"
                  >
                    <ProfileAvatar
                      avatarUrl={c.avatar_url}
                      name={c.name}
                      size={52}
                      ringClassName="ring-2 ring-slate-100"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        {mutualSet.has(c.peerId) ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                            Amigos
                          </span>
                        ) : null}
                      </div>
                      <p className="line-clamp-1 text-sm text-slate-500">{c.lastPreview}</p>
                      {when ? <p className="mt-0.5 text-xs font-medium text-slate-400">{when}</p> : null}
                    </div>
                    <span className="text-[#0585FC]">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {conversations.length === 0 ? (
            <p className="rounded-[2.5rem] border border-dashed border-slate-200/90 bg-white/90 px-5 py-8 text-center text-sm text-slate-500">
              Seguí jugadores en comunidad o esperá un mensaje para ver conversaciones acá.
            </p>
          ) : null}
        </>
      )}

      {showInfo ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.3)] dark:bg-[var(--bg-card)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cómo funcionan los mensajes</h3>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex gap-3">
                <span className="text-xl">👥</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">¿Quién te puede escribir?</p>
                  <p className="mt-0.5 leading-relaxed">
                    Solo las personas que vos seguís pueden iniciarte una conversación. Si alguien quiere
                    escribirte, primero necesita que vos lo sigas.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">➕</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">¿Cómo seguir a alguien?</p>
                  <p className="mt-0.5 leading-relaxed">
                    Entrá al perfil de un jugador desde Comunidad → Jugadores y tocá &quot;Seguir&quot;. Una vez
                    que lo seguís, podés iniciarle un chat.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">🤝</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Amigos mutuos</p>
                  <p className="mt-0.5 leading-relaxed">
                    Cuando dos jugadores se siguen mutuamente aparecen como &quot;Amigos&quot; y pueden crear
                    grupos de chat juntos.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">🚫</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Bloqueos</p>
                  <p className="mt-0.5 leading-relaxed">
                    Si bloqueás a alguien o te bloquean, no pueden ver ni iniciar conversaciones entre sí.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="mt-6 w-full rounded-2xl bg-[#0585FC] py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}

      {showCreate ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 px-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] pt-6">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Nuevo grupo</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <p className="text-xs font-semibold text-slate-500">Amigos mutuos</p>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {mutualFriends.map((f) => (
                  <label key={f.user_id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(f.user_id)}
                      onChange={() => toggleMember(f.user_id)}
                    />
                    <ProfileAvatar avatarUrl={f.avatar_url} name={f.name ?? "Jugador"} size={28} />
                    <span className="text-sm text-slate-700">{f.name?.trim() || "Jugador"}</span>
                  </label>
                ))}
              </div>
              {error ? <p className="text-xs text-rose-600">{error}</p> : null}
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await createGroupChatAction({ title, description, memberIds: selected });
                    if (!res.ok) {
                      setError(res.message);
                      return;
                    }
                    setShowCreate(false);
                    setTitle("");
                    setDescription("");
                    setSelected([]);
                    setError(null);
                    setActiveTab("grupos");
                  });
                }}
                className="w-full rounded-xl bg-[#0461C4] py-2.5 text-sm font-semibold text-white"
              >
                Crear grupo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
