"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { completeLevelingProfile } from "@/app/(player)/perfil/leveling-actions";
import {
  BASE_LEVEL_OPTIONS,
  QUIZ_QUESTIONS,
  computeLevelFromAnswers,
  scaleLabel,
  type BaseLevelChoice,
} from "@/lib/level-quiz-logic";

const SCORES = [1, 2, 3, 4, 5] as const;

const HAND_OPTS = [
  { value: "derecha", label: "Derecha" },
  { value: "izquierda", label: "Izquierda" },
] as const;

const POS_OPTS = [
  { value: "drive", label: "Drive" },
  { value: "reves", label: "Revés" },
] as const;

const SCH_OPTS = [
  { value: "manana", label: "Mañana" },
  { value: "mediodia", label: "Mediodía" },
  { value: "tarde", label: "Tarde" },
  { value: "noche", label: "Noche" },
] as const;

export function ProfileLevelingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [baseLevel, setBaseLevel] = useState<BaseLevelChoice | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    Array.from({ length: 10 }, () => null)
  );
  const [hand, setHand] = useState<string | null>(null);
  const [position, setPosition] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quizComplete = answers.every((a) => a !== null);

  const computation = useMemo(() => {
    if (!quizComplete) return null;
    try {
      return computeLevelFromAnswers(answers as number[]);
    } catch {
      return null;
    }
  }, [answers, quizComplete]);

  function setAnswer(index: number, value: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function onSubmit() {
    setError(null);
    if (!baseLevel || !quizComplete || !hand || !position || !schedule) {
      setError("Completá todos los campos.");
      return;
    }
    setBusy(true);
    const res = await completeLevelingProfile({
      answers: answers as number[],
      baseLevel,
      dominant_hand: hand,
      play_position: position,
      play_schedule: schedule,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="rounded-[2.5rem] border border-slate-200/60 bg-white p-6 shadow-[0_2px_24px_-8px_rgba(15,23,42,0.06)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Nivelación
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          Configurá tu perfil de juego
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Tres pasos rápidos. Solo lo vas a ver una vez.
        </p>
        <div className="mt-5 flex gap-1.5">
          {([1, 2, 3] as const).map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                step >= s ? "bg-sky-600" : "bg-slate-200"
              }`}
            />
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="s1"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.3 }}
            className="rounded-[2.5rem] border border-slate-200/60 bg-white p-6 shadow-[0_2px_24px_-8px_rgba(15,23,42,0.06)]"
          >
            <h2 className="text-base font-semibold text-slate-900">Nivel base</h2>
            <p className="mt-1 text-sm text-slate-500">¿Cómo te describirías hoy?</p>
            <div className="mt-5 flex flex-col gap-3">
              {BASE_LEVEL_OPTIONS.map((opt) => {
                const selected = baseLevel === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBaseLevel(opt.value)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                      selected
                        ? "border-sky-300 bg-sky-50/80 ring-2 ring-sky-500/20"
                        : "border-slate-100 bg-slate-50/40 hover:border-slate-200"
                    }`}
                  >
                    <span className="text-xl" aria-hidden>
                      {opt.emoji}
                    </span>
                    <span className="text-sm font-medium text-slate-900">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={!baseLevel}
              onClick={() => setStep(2)}
              className="mt-6 w-full rounded-2xl bg-sky-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar
            </button>
          </motion.div>
        ) : null}

        {step === 2 ? (
          <motion.div
            key="s2"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.3 }}
            className="rounded-[2.5rem] border border-slate-200/60 bg-white p-6 shadow-[0_2px_24px_-8px_rgba(15,23,42,0.06)]"
          >
            <h2 className="text-base font-semibold text-slate-900">Cuestionario</h2>
            <p className="mt-1 text-sm text-slate-500">10 preguntas · escala 1 a 5</p>
            <div className="mt-6 flex max-h-[min(52vh,420px)] flex-col gap-6 overflow-y-auto pr-1">
              {QUIZ_QUESTIONS.map((q, qi) => (
                <div key={q.id} className="border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-600/90">
                    {q.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-snug text-slate-800">{q.text}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SCORES.map((n) => {
                      const on = answers[qi] === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setAnswer(qi, n)}
                          className={`min-w-[3rem] rounded-xl px-3 py-2 text-xs font-semibold transition ${
                            on
                              ? "bg-sky-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                          title={scaleLabel(n)}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Atrás
              </button>
              <button
                type="button"
                disabled={!quizComplete}
                onClick={() => setStep(3)}
                className="flex-1 rounded-2xl bg-sky-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continuar
              </button>
            </div>
          </motion.div>
        ) : null}

        {step === 3 ? (
          <motion.div
            key="s3"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.3 }}
            className="rounded-[2.5rem] border border-slate-200/60 bg-white p-6 shadow-[0_2px_24px_-8px_rgba(15,23,42,0.06)]"
          >
            <h2 className="text-base font-semibold text-slate-900">Ficha técnica</h2>
            <p className="mt-1 text-sm text-slate-500">Últimos datos antes de guardar</p>

            {computation ? (
              <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 px-4 py-3.5">
                <p className="text-xs text-slate-500">
                  Categoría estimada según tus respuestas
                </p>
                <p className="text-lg font-semibold tracking-tight text-slate-900">
                  {computation.category}{" "}
                  <span className="text-sm font-medium text-slate-500">
                    · {computation.afterPenalty.toFixed(2)}
                  </span>
                </p>
                {computation.penaltyApplied ? (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-100">
                    Aplicamos un ajuste del 20%: la experiencia declarada (tiempo y frecuencia) no
                    encaja con un nivel técnico muy alto.
                  </p>
                ) : null}
                {computation.selfAssessmentWarning ? (
                  <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-950 ring-1 ring-sky-100">
                    Tu autoevaluación se aleja bastante del resto del cuestionario. Revisala si
                    querés; igual podés confirmar y guardar.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 space-y-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Mano
                </p>
                <div className="mt-2 flex gap-2">
                  {HAND_OPTS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setHand(o.value)}
                      className={`flex-1 rounded-2xl border py-3 text-sm font-medium transition ${
                        hand === o.value
                          ? "border-sky-400 bg-sky-50 text-sky-900"
                          : "border-slate-100 bg-slate-50/50 text-slate-700 hover:border-slate-200"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Posición
                </p>
                <div className="mt-2 flex gap-2">
                  {POS_OPTS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setPosition(o.value)}
                      className={`flex-1 rounded-2xl border py-3 text-sm font-medium transition ${
                        position === o.value
                          ? "border-sky-400 bg-sky-50 text-sky-900"
                          : "border-slate-100 bg-slate-50/50 text-slate-700 hover:border-slate-200"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Horario preferido
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {SCH_OPTS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setSchedule(o.value)}
                      className={`rounded-2xl border py-3 text-sm font-medium transition ${
                        schedule === o.value
                          ? "border-sky-400 bg-sky-50 text-sky-900"
                          : "border-slate-100 bg-slate-50/50 text-slate-700 hover:border-slate-200"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error ? (
              <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-100">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Atrás
              </button>
              <button
                type="button"
                disabled={busy || !hand || !position || !schedule}
                onClick={() => void onSubmit()}
                className="flex-1 rounded-2xl bg-slate-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Guardando…" : "Guardar perfil"}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
