"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { ProfileAvatar } from "@/components/profile-avatar";
import { DB_TABLES } from "@/lib/db-tables";

type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles?: { name: string | null; avatar_url: string | null } | null;
};

type Participant = {
  player_id: string;
  name: string | null;
  avatar_url: string | null;
};

export function MatchChat({
  matchId,
  currentUserId,
  participants,
  initialMessages,
  canWrite = true,
}: {
  matchId: string;
  currentUserId: string;
  participants: Participant[];
  initialMessages: Message[];
  canWrite?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const profileMap = useMemo(
    () => new Map(participants.map((p) => [p.player_id, p])),
    [participants]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`match-chat-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: DB_TABLES.matchMessages,
          filter: `match_id=eq.${matchId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          const profile = profileMap.get(newMsg.sender_id);
          setMessages((prev) => [
            ...prev,
            {
              ...newMsg,
              profiles: profile
                ? { name: profile.name, avatar_url: profile.avatar_url }
                : null,
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, profileMap, supabase]);

  async function handleSend() {
    if (!canWrite) return;
    if (!input.trim() || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");

    await supabase.from(DB_TABLES.matchMessages).insert({
      match_id: matchId,
      sender_id: currentUserId,
      content,
    });
    setSending(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden shadow-[var(--shadow-card)]">
      <div
        className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3"
        style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
      >
        <div className="flex -space-x-2">
          {participants.slice(0, 4).map((p) => (
            <ProfileAvatar
              key={p.player_id}
              avatarUrl={p.avatar_url}
              name={p.name ?? "J"}
              size={24}
              ringClassName="ring-2 ring-white"
            />
          ))}
        </div>
        <p className="text-sm font-semibold text-white">
          Chat del partido ({participants.length}/4)
        </p>
      </div>

      <div className="flex flex-col gap-3 p-4 min-h-[200px] max-h-[320px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-2xl">💬</p>
            <p className="text-sm text-[var(--text-tertiary)] text-center">
              Nadie escribió nada todavía.
              {" "}¡Rompé el hielo!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            const profile = profileMap.get(msg.sender_id);
            const name = profile?.name?.trim() ?? msg.profiles?.name?.trim() ?? "Jugador";
            const avatarUrl = profile?.avatar_url ?? msg.profiles?.avatar_url ?? null;
            const time = new Date(msg.created_at).toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                {!isMe && <ProfileAvatar avatarUrl={avatarUrl} name={name} size={28} />}
                <div className={`max-w-[75%] space-y-1 ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                  {!isMe && (
                    <p className="text-[10px] font-semibold text-[var(--text-tertiary)] px-1">
                      {name}
                    </p>
                  )}
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      isMe
                        ? "text-white rounded-tr-sm"
                        : "bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-tl-sm"
                    }`}
                    style={
                      isMe
                        ? { background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }
                        : {}
                    }
                  >
                    {msg.content}
                  </div>
                  <p className="text-[10px] text-[var(--text-tertiary)] px-1">{time}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={canWrite ? "Escribí un mensaje..." : "Solo lectura para este partido"}
          maxLength={500}
          disabled={!canWrite}
          className="flex-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[#0585FC] focus:ring-2 focus:ring-[#0585FC]/20"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canWrite || !input.trim() || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white transition-all disabled:opacity-50 hover:shadow-[0_4px_12px_rgba(5,133,252,0.4)]"
          style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
