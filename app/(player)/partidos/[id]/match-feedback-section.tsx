"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { submitMatchFeedback } from "./actions";

const FEEDBACK_TAGS = [
  "Buena cancha",
  "Excelente nivel",
  "Muy organizado",
  "Buen ambiente",
  "Llegaron a tiempo",
  "Recomendaría el club",
  "Cancha en mal estado",
  "Mal nivel del partido",
  "Desorganizado",
  "Problemas con el pago",
];

export function MatchFeedbackSection({
  matchId,
  alreadyLeftFeedback,
  initialRating = 0,
  initialTags = [],
}: {
  matchId: string;
  alreadyLeftFeedback: boolean;
  initialRating?: number;
  initialTags?: string[];
}) {
  const [rating, setRating] = useState(initialRating);
  const [hovered, setHovered] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(alreadyLeftFeedback);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function handleSubmit() {
    if (rating === 0) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("match_id", matchId);
      fd.set("rating", String(rating));
      fd.set("tags", selectedTags.join(","));
      fd.set("message", message);
      const result = await submitMatchFeedback(fd);
      if (result.ok) {
        setSubmitted(true);
      } else {
        setError(result.error ?? "Error al enviar feedback");
      }
    });
  }

  if (submitted) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <p className="mb-2 text-2xl">{"⭐".repeat(rating || initialRating)}</p>
        <p className="font-semibold text-emerald-800 dark:text-emerald-300">¡Gracias por tu feedback!</p>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
          Tu opinión ayuda a mejorar la comunidad.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">¿Cómo estuvo el partido?</h2>
        <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">
          Tu opinión es anónima y ayuda a mejorar la experiencia.
        </p>
      </div>

      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform active:scale-90"
          >
            <Star
              size={36}
              className={`transition-colors ${
                star <= (hovered || rating)
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-[var(--border-subtle)]"
              }`}
            />
          </button>
        ))}
      </div>

      {rating > 0 ? (
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                selectedTags.includes(tag)
                  ? "bg-[#0085FC] text-white"
                  : "border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {rating === 1 ? (
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Contanos qué salió mal (opcional)..."
          maxLength={500}
          rows={3}
          className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[#0085FC] focus:outline-none focus:ring-2 focus:ring-[#0085FC]/20"
        />
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={rating === 0 || isPending}
        className="w-full rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] py-3.5 text-sm font-bold text-white transition disabled:opacity-40"
      >
        {isPending ? "Enviando..." : "Enviar feedback"}
      </button>
    </section>
  );
}
