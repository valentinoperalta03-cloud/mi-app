"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  recordMatchResultAction,
  type RecordMatchResultState,
} from "@/app/(player)/partidos/[id]/match-result-actions";
import { isValidPadelSet, validateBestOfThreeSets } from "@/lib/padel-set-score";

const initial: RecordMatchResultState = { ok: false, message: "" };

const PADEL_FACTS = [
  "🎾 El pádel nació en México en 1969. ¡Ya sos parte de la historia!",
  "💪 Cada partido mejora tu reacción, coordinación y trabajo en equipo.",
  "🏆 Los mejores jugadores del mundo perdieron miles de partidos antes de ganar.",
  "🤝 En el pádel, la dupla que mejor se comunica gana más que la que mejor golpea.",
  "⚡ Un partido de pádel quema entre 400 y 600 calorías. ¡Bien ganado!",
  "🧠 El pádel desarrolla la inteligencia táctica más que cualquier otro deporte de raqueta.",
];

function SubmitRow({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-2xl py-4 text-base font-bold text-white shadow-[0_4px_16px_rgba(5,133,252,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(5,133,252,0.4)] active:scale-[0.98] disabled:opacity-60"
      style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

type SetScore = { a: number; b: number };

function clampGames(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(7, Math.round(n)));
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
  const [sets, setSets] = useState<SetScore[]>([
    { a: 0, b: 0 },
    { a: 0, b: 0 },
    { a: 0, b: 0 },
  ]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const { needsThird, payloadForSubmit, previewLabel } = useMemo(() => {
    const s0 = sets[0]!;
    const s1 = sets[1]!;
    const s2 = sets[2]!;
    if (!isValidPadelSet(s0.a, s0.b) || !isValidPadelSet(s1.a, s1.b)) {
      const parts: string[] = [];
      if (s0.a > 0 || s0.b > 0) parts.push(`${s0.a}-${s0.b}`);
      if (s1.a > 0 || s1.b > 0) parts.push(`${s1.a}-${s1.b}`);
      return { needsThird: false, payloadForSubmit: [] as SetScore[], previewLabel: parts.join(" / ") || "—" };
    }
    const aWins = (s0.a > s0.b ? 1 : 0) + (s1.a > s1.b ? 1 : 0);
    const bWins = (s0.b > s0.a ? 1 : 0) + (s1.b > s1.a ? 1 : 0);
    if (aWins === 2 || bWins === 2) {
      const payload = [s0, s1];
      return {
        needsThird: false,
        payloadForSubmit: payload,
        previewLabel: payload.map((s) => `${s.a}-${s.b}`).join(" / "),
      };
    }
    if (aWins === 1 && bWins === 1) {
      const basePreview = `${s0.a}-${s0.b} / ${s1.a}-${s1.b}`;
      if (!isValidPadelSet(s2.a, s2.b)) {
        return {
          needsThird: true,
          payloadForSubmit: [] as SetScore[],
          previewLabel: `${basePreview} / …`,
        };
      }
      const payload = [s0, s1, s2];
      return {
        needsThird: true,
        payloadForSubmit: payload,
        previewLabel: payload.map((s) => `${s.a}-${s.b}`).join(" / "),
      };
    }
    return { needsThird: false, payloadForSubmit: [] as SetScore[], previewLabel: `${s0.a}-${s0.b} / ${s1.a}-${s1.b}` };
  }, [sets]);

  const validation = useMemo(() => validateBestOfThreeSets(payloadForSubmit), [payloadForSubmit]);
  const canSubmit = validation.ok;

  const fact = PADEL_FACTS[Math.abs(matchId.length) % PADEL_FACTS.length]!;

  useEffect(() => {
    if (!state.ok) return;
    if (state.message?.includes("Carga iniciada")) {
      setStarted(true);
    } else {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
    }
    router.refresh();
  }, [router, state.ok, state.message]);

  function setGame(idx: number, side: "a" | "b", raw: string) {
    const n = clampGames(Number.parseInt(raw, 10) || 0);
    setSets((prev) => prev.map((row, i) => (i === idx ? { ...row, [side]: n } : row)));
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
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition active:scale-95"
          aria-label="Cómo funciona el resultado"
        >
          <Info size={16} />
        </button>
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
        <p className="mt-1 text-sm text-white/70">Marcador por sets (juegos ganados por set)</p>
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
          <input
            type="hidden"
            name="team_a_score"
            value={canSubmit ? String(validation.setsWonA ?? 0) : "0"}
          />
          <input
            type="hidden"
            name="team_b_score"
            value={canSubmit ? String(validation.setsWonB ?? 0) : "0"}
          />
          <input type="hidden" name="sets_json" value={JSON.stringify(payloadForSubmit)} />

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

          <p className="text-center text-sm font-semibold text-[var(--text-primary)]">
            Parcial: <span className="text-[#0585FC]">{previewLabel}</span>
          </p>

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
                <label className="flex flex-col items-center gap-1">
                  <span className="text-xs text-[var(--text-tertiary)]">Equipo A</span>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    value={sets[idx]!.a}
                    onChange={(e) => setGame(idx, "a", e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-center text-lg font-bold text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col items-center gap-1">
                  <span className="text-xs text-[var(--text-tertiary)]">Equipo B</span>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    value={sets[idx]!.b}
                    onChange={(e) => setGame(idx, "b", e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-center text-lg font-bold text-[var(--text-primary)]"
                  />
                </label>
              </div>
            </motion.div>
          ))}

          {needsThird ? (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20"
            >
              <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300">
                Set 3 (desempate)
              </p>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col items-center gap-1">
                  <span className="text-xs text-[var(--text-tertiary)]">Equipo A</span>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    value={sets[2]!.a}
                    onChange={(e) => setGame(2, "a", e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-center text-lg font-bold text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col items-center gap-1">
                  <span className="text-xs text-[var(--text-tertiary)]">Equipo B</span>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    value={sets[2]!.b}
                    onChange={(e) => setGame(2, "b", e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-center text-lg font-bold text-[var(--text-primary)]"
                  />
                </label>
              </div>
            </motion.div>
          ) : null}

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
            <p className="text-center text-xs text-[var(--text-tertiary)]">Sets ganados (cuando el marcador sea válido)</p>
            <div className="mt-2 grid grid-cols-3 items-center gap-2 text-center">
              <div>
                <p className="text-3xl font-bold text-[#0585FC]">
                  {canSubmit ? validation.setsWonA : "—"}
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">Equipo A</p>
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--text-tertiary)]">vs</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-600 dark:text-slate-300">
                  {canSubmit ? validation.setsWonB : "—"}
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">Equipo B</p>
              </div>
            </div>
          </div>

          {!canSubmit && payloadForSubmit.length === 0 && (sets[0]!.a > 0 || sets[0]!.b > 0) ? (
            <p className="text-center text-xs text-amber-700 dark:text-amber-400">
              {validation.message ?? "Completá sets válidos de pádel (6-4, 7-6, etc.)."}
            </p>
          ) : null}

          <SubmitRow label="Enviar para confirmación 🎾" disabled={!canSubmit} />
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
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cómo funciona el resultado</h3>
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
                <span className="text-xl">📊</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Cargá el marcador</p>
                  <p className="mt-0.5 leading-relaxed">
                    Tocá &quot;Cargar resultado&quot; para tomar el control. Tenés 30 minutos para ingresar el
                    marcador por sets. Solo uno por equipo puede cargar a la vez.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Confirmación de los 4</p>
                  <p className="mt-0.5 leading-relaxed">
                    Los otros 3 jugadores deben confirmar el resultado. Si todos confirman, el partido queda
                    cerrado y se actualiza el ranking.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">⚡</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Partidos competitivos</p>
                  <p className="mt-0.5 leading-relaxed">
                    Solo los partidos competitivos actualizan tu ELO. Los amistosos se registran pero no
                    afectan tu ranking.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">🚫</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">¿El resultado está mal?</p>
                  <p className="mt-0.5 leading-relaxed">
                    Tocá &quot;Disputar&quot; y cualquier jugador podrá proponer un nuevo marcador. Solo se
                    borra tu confirmación, no la de los demás.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-xl">⏱</span>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Confirmación automática</p>
                  <p className="mt-0.5 leading-relaxed">
                    Si pasan 72 horas sin que todos confirmen, el resultado se confirma automáticamente.
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
    </div>
  );
}
