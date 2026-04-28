"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  recordMatchResultAction,
  type RecordMatchResultState,
} from "@/app/(player)/matches/[id]/actions";

const initial: RecordMatchResultState = { ok: false, message: "" };

const PADEL_FACTS = [
  "🎾 El pádel nació en México en 1969. ¡Ya sos parte de la historia!",
  "💪 Cada partido mejora tu reacción, coordinación y trabajo en equipo.",
  "🏆 Los mejores jugadores del mundo perdieron miles de partidos antes de ganar.",
  "🤝 En el pádel, la dupla que mejor se comunica gana más que la que mejor golpea.",
  "⚡ Un partido de pádel quema entre 400 y 600 calorías. ¡Bien ganado!",
  "🧠 El pádel desarrolla la inteligencia táctica más que cualquier otro deporte de raqueta.",
];

function SubmitRow({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl py-4 text-base font-bold text-white shadow-[0_4px_16px_rgba(5,133,252,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(5,133,252,0.4)] active:scale-[0.98] disabled:opacity-60"
      style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

export function MatchResultForm({
  matchId,
  teamALabel,
  teamBLabel,
  lockedByTeammate,
  alreadyStarted,
}: {
  matchId: string;
  teamALabel: string;
  teamBLabel: string;
  lockedByTeammate: boolean;
  alreadyStarted: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(recordMatchResultAction, initial);
  const [started, setStarted] = useState(alreadyStarted);
  const [sets, setSets] = useState([
    { a: 6, b: 4 },
    { a: 6, b: 2 },
  ]);
  const [showCelebration, setShowCelebration] = useState(false);

  const totals = useMemo(
    () => ({
      a: sets.reduce((acc, s) => acc + s.a, 0),
      b: sets.reduce((acc, s) => acc + s.b, 0),
    }),
    [sets]
  );

  const fact = PADEL_FACTS[Math.abs(matchId.length) % PADEL_FACTS.length]!;

  useEffect(() => {
    if (state.ok) {
      if (!started) setStarted(true);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
      router.refresh();
    }
  }, [router, started, state.ok]);

  function adjustSet(idx: number, side: "a" | "b", delta: number) {
    setSets((prev) =>
      prev.map((set, i) =>
        i === idx ? { ...set, [side]: Math.max(0, Math.min(7, set[side] + delta)) } : set
      )
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {showCelebration ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <div className="space-y-4 px-8 text-center">
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-6xl"
              >
                🏆
              </motion.p>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-white"
              >
                ¡Resultado enviado!
              </motion.p>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-sm text-white/80"
              >
                Esperando que los otros jugadores confirmen
              </motion.p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-6 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
      >
        <div className="absolute right-3 top-3 opacity-10">
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
            <circle cx="30" cy="30" r="28" stroke="white" strokeWidth="2" />
            <path d="M8 22 Q30 18 52 22" stroke="white" strokeWidth="2" fill="none" />
            <path d="M8 30 Q30 26 52 30" stroke="white" strokeWidth="2" fill="none" />
            <path d="M8 38 Q30 34 52 38" stroke="white" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <p className="mb-2 text-3xl">🎾</p>
        <h2 className="text-xl font-bold">¡Gran partido!</h2>
        <p className="mt-1 text-sm text-white/70">¿Quiénes se llevaron la victoria hoy?</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3"
      >
        <p className="text-center text-sm leading-relaxed text-[var(--text-secondary)]">{fact}</p>
      </motion.div>

      {!started ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <form action={formAction}>
            <input type="hidden" name="match_id" value={matchId} />
            <input type="hidden" name="intent" value="start" />
            <button
              type="submit"
              disabled={lockedByTeammate}
              className="w-full rounded-2xl py-4 text-base font-bold text-white shadow-[0_4px_16px_rgba(5,133,252,0.3)] transition-all hover:-translate-y-0.5 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
            >
              📊 Cargar resultado
            </button>
          </form>
          {lockedByTeammate ? (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-center text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              Tu pareja ya está cargando el resultado.
            </p>
          ) : null}
        </motion.div>
      ) : (
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          action={formAction}
          className="space-y-4"
        >
          <input type="hidden" name="match_id" value={matchId} />
          <input type="hidden" name="intent" value="propose" />
          <input type="hidden" name="team_a_score" value={totals.a} />
          <input type="hidden" name="team_b_score" value={totals.b} />
          <input type="hidden" name="sets_json" value={JSON.stringify(sets)} />

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/10 p-3 dark:bg-[#0585FC]/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#0585FC]">Equipo A</p>
              <p className="mt-1 truncate text-sm font-bold text-[var(--text-primary)]">{teamALabel}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-slate-100 p-3 dark:bg-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Equipo B
              </p>
              <p className="mt-1 truncate text-sm font-bold text-[var(--text-primary)]">{teamBLabel}</p>
            </div>
          </div>

          {[0, 1].map((idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4"
            >
              <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
                Set {idx + 1}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {(["a", "b"] as const).map((side) => (
                  <div key={side} className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => adjustSet(idx, side, -1)}
                        className="h-9 w-9 rounded-full border-2 border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-lg font-bold text-[var(--text-primary)] transition hover:border-[#0585FC] hover:text-[#0585FC]"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-2xl font-bold text-[var(--text-primary)]">
                        {sets[idx]![side]}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustSet(idx, side, 1)}
                        className="h-9 w-9 rounded-full border-2 border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-lg font-bold text-[var(--text-primary)] transition hover:border-[#0585FC] hover:text-[#0585FC]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
            <div className="grid grid-cols-3 items-center gap-2 text-center">
              <div>
                <p className="text-3xl font-bold text-[#0585FC]">{totals.a}</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">Equipo A</p>
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--text-tertiary)]">vs</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-600 dark:text-slate-300">{totals.b}</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">Equipo B</p>
              </div>
            </div>
          </div>

          <SubmitRow label="Enviar para confirmación 🎾" />
        </motion.form>
      )}

      {state.message ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          role={state.ok ? "status" : "alert"}
          className={`rounded-2xl px-4 py-3 text-center text-sm font-medium ${
            state.ok
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
          }`}
        >
          {state.message}
        </motion.p>
      ) : null}
    </div>
  );
}
