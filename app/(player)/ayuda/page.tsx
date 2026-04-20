"use client";

import { Bot, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "¿Cómo reservo?",
  "¿Cuánto cuesta?",
  "¿Cómo funcionan los niveles?",
  "¿Puedo cancelar?",
  "Reglas del pádel",
] as const;

export default function AyudaPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "¡Hola! Soy el asistente de Padelibre. ¿En qué puedo ayudarte hoy?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  async function sendMessage(userInput: string) {
    const text = userInput.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = (await res.json()) as { content?: string };
      const content = data.content?.trim() || "No pude procesar tu consulta.";
      setMessages((prev) => [...prev, { role: "assistant", content }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Hubo un problema de conexión. Probá de nuevo en un ratito." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function formatMessage(content: string) {
    return content.split("\n").map((line, lineIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g).filter(Boolean);
      return (
        <span key={`${line}-${lineIdx}`}>
          {parts.map((part, idx) => {
            if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
              return <strong key={`${part}-${idx}`}>{part.slice(2, -2)}</strong>;
            }
            return <span key={`${part}-${idx}`}>{part}</span>;
          })}
          {lineIdx < content.split("\n").length - 1 ? <br /> : null}
        </span>
      );
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-transparent">
      <header className="flex h-14 items-center gap-2 bg-sky-500 px-4 text-white">
        <Bot size={18} />
        <h1 className="text-lg font-bold">Ayuda</h1>
      </header>

      <div ref={viewportRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 pb-28">
        {messages.map((message, idx) => (
          <div key={`${message.role}-${idx}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                message.role === "user" ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              {formatMessage(message.content)}
            </div>
          </div>
        ))}

        {messages.length === 1 ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => void sendMessage(chip)}
                className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700"
              >
                {chip}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl bg-slate-100 px-4 py-3 text-slate-500">
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
            </div>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="fixed bottom-0 left-1/2 flex w-full max-w-md -translate-x-1/2 gap-2 border-t border-slate-200 bg-white p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribí tu consulta..."
          className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-3 text-white disabled:opacity-70"
          aria-label="Enviar mensaje"
        >
          <Send size={16} />
        </button>
      </form>
    </main>
  );
}
