"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import {
  addGroupMemberAction,
  sendGroupChatMessageAction,
  type GroupChatMessageRow,
} from "@/app/(player)/comunidad/mensajes/actions";
import { ProfileAvatar } from "@/components/profile-avatar";
import { createClient } from "@/utils/supabase/client";
import { DB_TABLES } from "@/lib/db-tables";

type Profile = { user_id: string; name: string | null; avatar_url: string | null };

export function GroupChatClient({
  groupId,
  title,
  description,
  myId,
  isAdmin,
  initialMessages,
  profiles,
  addCandidates,
}: {
  groupId: string;
  title: string;
  description: string | null;
  myId: string;
  isAdmin: boolean;
  initialMessages: GroupChatMessageRow[];
  profiles: Profile[];
  addCandidates: Profile[];
}) {
  const [items, setItems] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [pendingSend, startSend] = useTransition();
  const [pendingMember, startMember] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const profileMap = useMemo(
    () =>
      new Map(
        profiles.map((p) => [p.user_id, { name: p.name?.trim() || "Jugador", avatar_url: p.avatar_url }])
      ),
    [profiles]
  );

  useEffect(() => {
    setItems(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`group-chat:${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: DB_TABLES.groupChatMessages, filter: `group_id=eq.${groupId}` },
        (payload) => {
          const row = payload.new as GroupChatMessageRow;
          setItems((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId]);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-[var(--bg-app)] px-4 pb-4 pt-6">
      <header className="mb-3 shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Link href="/comunidad/mensajes" className="text-sm font-semibold text-[#0085FC]">
            ← Mensajes
          </Link>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              <Plus size={14} />
              Agregar miembro
            </button>
          ) : null}
        </div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {description ? <p className="text-xs text-slate-500 whitespace-pre-line">{description}</p> : null}
      </header>

      {showAdd && isAdmin ? (
        <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-slate-500">Amigos mutuos disponibles</p>
          <div className="space-y-2">
            {addCandidates.map((candidate) => (
              <button
                key={candidate.user_id}
                type="button"
                disabled={pendingMember}
                onClick={() => {
                  startMember(async () => {
                    const res = await addGroupMemberAction(groupId, candidate.user_id);
                    if (!res.ok) setMemberError(res.message);
                  });
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <ProfileAvatar avatarUrl={candidate.avatar_url} name={candidate.name ?? "Jugador"} size={26} />
                  {candidate.name?.trim() || "Jugador"}
                </span>
                <span className="text-[#0085FC]">+</span>
              </button>
            ))}
          </div>
          {memberError ? <p className="mt-2 text-xs text-rose-600">{memberError}</p> : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 pb-44">
        {items.map((m) => {
          const mine = m.sender_id === myId;
          const profile = profileMap.get(m.sender_id);
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] ${mine ? "" : "pl-9"}`}>
                {!mine ? (
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-500">
                    <ProfileAvatar avatarUrl={profile?.avatar_url ?? null} name={profile?.name ?? "Jugador"} size={20} />
                    <span>{profile?.name ?? "Jugador"}</span>
                  </div>
                ) : null}
                <div className={`rounded-2xl px-3 py-2 text-sm ${mine ? "bg-[#0461C4] text-white" : "bg-slate-100 text-slate-800"}`}>
                  {m.content}
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  {format(new Date(m.created_at), "HH:mm", { locale: es })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div
        className="pointer-events-none fixed left-0 right-0 z-40 flex justify-center px-3"
        style={{ bottom: "max(6rem, calc(env(safe-area-inset-bottom) + 5.25rem))" }}
      >
        <div className="pointer-events-auto w-full max-w-md border-t border-white/35 bg-white/70 px-3 py-3 shadow-[0_-8px_32px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl backdrop-saturate-150">
          {msgError ? <p className="mb-2 rounded-2xl bg-rose-50 px-3 py-1.5 text-xs text-rose-700">{msgError}</p> : null}
          <div className="flex items-center gap-2 rounded-[2rem] border border-slate-200/80 bg-white/95 px-1 py-1 shadow-inner shadow-slate-200/30">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Mensaje al grupo"
              className="min-h-[44px] flex-1 rounded-[2rem] bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              disabled={pendingSend || !input.trim()}
              onClick={() => {
                startSend(async () => {
                  const res = await sendGroupChatMessageAction(groupId, input);
                  if (!res.ok || !res.row) {
                    setMsgError(res.message);
                    return;
                  }
                  setInput("");
                  setItems((prev) => (prev.some((m) => m.id === res.row!.id) ? prev : [...prev, res.row!]));
                });
              }}
              className="btn-primary-gradient mb-0.5 shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition hover:brightness-95 disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
