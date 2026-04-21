"use client";

import { HelpCircle, MessageCircle } from "lucide-react";
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-transparent">
      <header className="flex h-14 items-center gap-2 bg-[#0585FC]/50 px-4 text-white">
        <HelpCircle size={18} />
        <h1 className="text-lg font-bold">Centro de ayuda</h1>
      </header>

      <div ref={viewportRef} className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {messages.length === 0 ? (
          <section className="space-y-4">
            <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#0585FC]/10 text-[#0585FC]">
                <MessageCircle size={28} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">¿En qué podemos ayudarte?</h2>
              <p className="text-sm text-slate-500">Seleccioná una categoría</p>
            </div>

            {!selectedCategory ? (
              <div className="grid grid-cols-2 gap-3">
                {CATEGORY_ORDER.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-4 text-left transition-colors hover:bg-slate-50"
                  >
                    <p className="text-xl">{CATEGORY_ICON[category]}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{category}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-600">{selectedCategory}</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(null)}
                    className="text-xs font-semibold text-[#0585FC]"
                  >
                    Volver
                  </button>
                </div>
                <div className="space-y-2">
                  {(grouped.get(selectedCategory) ?? []).map((qa) => (
                    <button
                      key={qa.id}
                      type="button"
                      onClick={() => void askQuestion(qa)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
                    >
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-4">
            {messages.map((m, idx) => (
              <div key={`${m.question}-${idx}`} className="space-y-2">
                <div className="flex justify-end">
                  <div className="max-w-[85%] break-words rounded-2xl bg-[#0585FC]/50 px-4 py-2 text-sm text-white">{m.question}</div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[85%] break-words rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-800">
                    {m.answer ? formatMessage(m.answer) : "Cargando respuesta..."}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(m.category)}
                    className="rounded-full border border-[#0585FC]/20 bg-[#0585FC]/5 px-3 py-1 text-xs font-semibold text-[#0461C4]"
                  >
                    Ver más preguntas de {m.category}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMessages([]);
                      setSelectedCategory(null);
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    Volver al inicio
                  </button>
                </div>
              </div>
            ))}

            <div>
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory ?? "Pagos")}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Ver otras preguntas
              </button>
            </div>
          </section>
        )}

        {selectedCategory && messages.length > 0 ? (
          <section className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-slate-600">{selectedCategory}</h3>
            {(grouped.get(selectedCategory) ?? []).map((qa) => (
              <button
                key={`post-${qa.id}`}
                type="button"
                onClick={() => void askQuestion(qa)}
                disabled={loading}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                {qa.label}
              </button>
            ))}
          </section>
        ) : null}

        {!loaded ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-center text-sm text-slate-500">
            Cargando centro de ayuda...
          </div>
        ) : null}
      </div>
    </main>
  );
}
