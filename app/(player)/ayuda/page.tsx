"use client";

import { Bot, ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type QA = { id: string; label: string; answer: string; category: string };
type ChatMessage = { question: string; answer: string; category: string };

const CATEGORY_ORDER = ["Pagos", "Devoluciones", "Partidos", "Inconvenientes", "Más ayuda"] as const;
const CATEGORY_ICON: Record<string, string> = {
  Pagos: "💳",
  Devoluciones: "🔄",
  Partidos: "🎾",
  Inconvenientes: "⚠️",
  "Más ayuda": "📞",
};

export default function AyudaPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QA[]>([]);
  const [loaded, setLoaded] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchQuestions() {
      try {
        const res = await fetch("/api/ai/chat");
        const data = (await res.json()) as { questions?: QA[] };
        setQuestions(data.questions ?? []);
      } catch {
        setQuestions([]);
      } finally {
        setLoaded(true);
      }
    }
    void fetchQuestions();
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading, selectedCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, QA[]>();
    for (const q of questions) {
      const arr = map.get(q.category) ?? [];
      arr.push(q);
      map.set(q.category, arr);
    }
    return map;
  }, [questions]);

  function formatMessage(content: string) {
    const lines = content.split("\n");
    return lines.map((line, lineIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g).filter(Boolean);
      return (
        <span key={`${line}-${lineIdx}`}>
          {parts.map((part, idx) => {
            if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
              return <strong key={`${part}-${idx}`}>{part.slice(2, -2)}</strong>;
            }
            return <span key={`${part}-${idx}`}>{part}</span>;
          })}
          {lineIdx < lines.length - 1 ? <br /> : null}
        </span>
      );
    });
  }

  async function askQuestion(qa: QA) {
    if (loading) return;
    setMessages((prev) => [...prev, { question: qa.label, answer: "", category: qa.category }]);
    setLoading(true);
    setSelectedCategory(null);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: qa.id }),
      });
      const data = (await res.json()) as { content?: string };
      const content = data.content?.trim() || "No pudimos procesar tu consulta en este momento.";
      setMessages((prev) => {
        const next = [...prev];
        const idx = next.length - 1;
        if (idx >= 0) next[idx] = { ...next[idx], answer: content };
        return next;
      });
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        const idx = next.length - 1;
        if (idx >= 0) next[idx] = { ...next[idx], answer: "Hubo un problema. Intentá nuevamente." };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[var(--bg-app)]">
      <header className="flex items-center gap-3 bg-gradient-to-r from-[#0585FC] to-[#0461C4] px-4 py-4 text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
          <Bot size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold">Chat Bot</h1>
          <p className="text-xs text-white/75">Respondemos tus dudas al instante</p>
        </div>
      </header>

      <div ref={viewportRef} className="flex-1 overflow-y-auto px-4 py-4 pb-32">
        {messages.length === 0 && !selectedCategory ? (
          <section className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0585FC]">
                <Bot size={16} className="text-white" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-card)]">
                <p className="text-sm text-[var(--text-primary)]">
                  ¡Hola! Soy el Chat Bot de PadeLibre 👋 ¿En qué puedo ayudarte hoy?
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">Seleccioná una categoría para empezar</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {CATEGORY_ORDER.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-4 text-left shadow-[var(--shadow-card)] transition active:scale-[0.97]"
                >
                  <p className="text-2xl">{CATEGORY_ICON[category]}</p>
                  <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">{category}</p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {selectedCategory && messages.length === 0 ? (
          <section className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0585FC]">
                <Bot size={16} className="text-white" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-card)]">
                <p className="text-sm text-[var(--text-primary)]">
                  {CATEGORY_ICON[selectedCategory]} <strong>{selectedCategory}</strong> — ¿Cuál es tu consulta?
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="flex items-center gap-1 text-xs font-semibold text-[#0585FC]"
            >
              <ChevronLeft size={14} /> Volver a categorías
            </button>
            <div className="space-y-2">
              {(grouped.get(selectedCategory) ?? []).map((qa) => (
                <button
                  key={qa.id}
                  type="button"
                  onClick={() => void askQuestion(qa)}
                  className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] shadow-[var(--shadow-card)] transition active:scale-[0.98]"
                >
                  {qa.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {messages.length > 0 ? (
          <section className="space-y-4">
            {messages.map((m, idx) => (
              <div key={`${m.question}-${idx}`} className="space-y-3">
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[#0585FC] px-4 py-2.5 text-sm text-white shadow-sm">
                    {m.question}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0585FC]">
                    <Bot size={16} className="text-white" />
                  </div>
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-[var(--shadow-card)]">
                    {m.answer ? (
                      formatMessage(m.answer)
                    ) : (
                      <span className="text-[var(--text-tertiary)]">Escribiendo...</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {!loading ? (
              <div className="flex flex-wrap gap-2 pl-11">
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setSelectedCategory(null);
                  }}
                  className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] shadow-sm transition active:scale-[0.97]"
                >
                  Nueva consulta
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(messages[messages.length - 1]?.category ?? null)}
                  className="rounded-full border border-[#0585FC]/25 bg-[#0585FC]/5 px-3 py-1.5 text-xs font-semibold text-[#0461C4] shadow-sm transition active:scale-[0.97] dark:text-sky-400"
                >
                  Más preguntas
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {selectedCategory && messages.length > 0 ? (
          <section className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              {selectedCategory}
            </p>
            {(grouped.get(selectedCategory) ?? []).map((qa) => (
              <button
                key={`post-${qa.id}`}
                type="button"
                onClick={() => void askQuestion(qa)}
                disabled={loading}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] shadow-[var(--shadow-card)] transition active:scale-[0.98] disabled:opacity-60"
              >
                {qa.label}
              </button>
            ))}
          </section>
        ) : null}

        {!loaded ? (
          <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 text-center text-sm text-[var(--text-secondary)]">
            Cargando Chat Bot...
          </div>
        ) : null}
      </div>
    </main>
  );
}
