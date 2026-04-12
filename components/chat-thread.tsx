"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useRef, useState } from "react";
import { sendChatMessage, type ChatMessageRow } from "@/app/(player)/comunidad/mensajes/actions";
import { createClient } from "@/utils/supabase/client";

function ChatInputBar({
  onSend,
}: {
  onSend: (text: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    const t = value.trim();
    if (!t || pending) return;
    setErr(null);
    setPending(true);
    const res = await onSend(t);
    setPending(false);
    if (!res.ok) {
      setErr(res.message);
      return;
    }
    setValue("");
  }

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 z-40 flex justify-center px-3"
      style={{ bottom: "max(5.25rem, calc(env(safe-area-inset-bottom) + 4.5rem))" }}
    >
      <div className="pointer-events-auto w-full max-w-md border-t border-white/35 bg-white/70 px-3 py-3 shadow-[0_-8px_32px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl backdrop-saturate-150">
        {err ? (
          <p className="mb-2 rounded-2xl bg-rose-50 px-3 py-1.5 text-xs text-rose-700">{err}</p>
        ) : null}
        <div className="flex items-end gap-2 rounded-[2rem] border border-slate-200/80 bg-white/95 px-1 py-1 shadow-inner shadow-slate-200/30">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={1}
            placeholder="Mensaje"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-[2rem] bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            disabled={pending || !value.trim()}
            onClick={() => void submit()}
            className="mb-0.5 shrink-0 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChatThread({
  initialMessages,
  myId,
  peerId,
}: {
  initialMessages: ChatMessageRow[];
  myId: string;
  peerId: string;
}) {
  const [items, setItems] = useState(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages-dm:${myId}:${peerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          const involved =
            (row.sender_id === myId && row.receiver_id === peerId) ||
            (row.sender_id === peerId && row.receiver_id === myId);
          if (!involved) return;
          setItems((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId, peerId]);

  async function onSend(text: string) {
    const res = await sendChatMessage(peerId, text);
    if (res.ok && res.row) {
      setItems((prev) => {
        if (prev.some((m) => m.id === res.row!.id)) return prev;
        return [...prev, res.row!];
      });
    }
    return res;
  }

  return (
    <>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1 pb-44 pt-2">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Sin mensajes todavía. Saludá 👋</p>
        ) : null}
        {items.map((m) => {
          const mine = m.sender_id === myId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-[1.75rem] px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                  mine
                    ? "rounded-br-md bg-sky-600 text-white"
                    : "rounded-bl-md bg-slate-100 text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                <p
                  className={`mt-1 text-[10px] font-medium tabular-nums ${
                    mine ? "text-sky-100/90" : "text-slate-400"
                  }`}
                >
                  {format(new Date(m.created_at), "HH:mm", { locale: es })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <ChatInputBar onSend={onSend} />
    </>
  );
}
