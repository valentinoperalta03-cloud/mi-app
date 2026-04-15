"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { completeLevelingProfile } from "@/app/(player)/perfil/leveling-actions";
import {
  BASE_LEVEL_OPTIONS,
  QUIZ_ANSWER_OPTIONS,
  QUIZ_QUESTIONS,
  computeLevelFromAnswers,
  type BaseLevelChoice,
} from "@/lib/level-quiz-logic";

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
  const [baseLevel, setBaseLevel] = useState<BaseLevelChoice | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    Array.from({ length: QUIZ_QUESTIONS.length }, () => null)
  );
  const [hand, setHand] = useState<string | null>(null);
  const [position, setPosition] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<"base" | "quiz" | "details">("base");
  const quizComplete = answers.every((a) => a !== null);
  const currentQuestion = QUIZ_QUESTIONS[questionIndex];
  const selectedAnswer = answers[questionIndex];
  const progressPct = ((questionIndex + 1) / QUIZ_QUESTIONS.length) * 100;

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

  function goToNextQuestion() {
    if (questionIndex >= QUIZ_QUESTIONS.length - 1) {
      setPhase("details");
      return;
    }
    setQuestionIndex((prev) => prev + 1);
  }

  function handleSelectAnswer(score: number) {
    setAnswer(questionIndex, score);
    setAutoAdvancing(true);
    window.setTimeout(() => {
      goToNextQuestion();
      setAutoAdvancing(false);
    }, 180);
  }

  async function onSubmit() {
    setError(null);
    if (!baseLevel || !quizComplete || !hand || !position || !schedule) {
      setError("Completá todos los campos.");
      return;
    }
    setBusy(true);
    try {
      const res = await completeLevelingProfile({
        answers: answers as number[],
        baseLevel,
        preferred_hand: hand,
        court_position: position,
        preferred_schedule: schedule,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.push("/home?nivelacion=ok");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-8" suppressHydrationWarning>
      <header className="rounded-[2.2rem] border border-white/10 bg-[#020b1c] p-6 text-white shadow-[0_18px_50px_-24px_rgba(8,47,73,0.9)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200/80">
          Nivelacion inteligente
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Configura tu perfil paso a paso
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-200/80">
          Una pregunta por pantalla para que sea rapido y claro desde el celular.
        </p>
        {phase === "quiz" ? (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-sky-100/90">
              <span>Progreso</span>
              <span>
                {questionIndex + 1}/{QUIZ_QUESTIONS.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
              <motion.div
                className="h-full rounded-full bg-cyan-300"
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.28, ease: "easeOut" }}
              />
            </div>
          </div>
        ) : null}
      </header>

      <AnimatePresence mode="wait">
        {phase === "base" ? (
          <motion.div
            key="base"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.3 }}
            className="rounded-[2.2rem] border border-white/10 bg-[#020b1c] p-6 text-white"
          >
            <h2 className="text-lg font-semibold">Nivel base</h2>
            <p className="mt-1 text-base text-slate-200/85">Como te describirias hoy?</p>
            <div className="mt-5 flex flex-col gap-3">
              {BASE_LEVEL_OPTIONS.map((opt) => {
                const selected = baseLevel === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBaseLevel(opt.value)}
                    className={`flex w-full items-center gap-3 rounded-3xl border px-5 py-4 text-left transition ${
                      selected
                        ? "border-cyan-300/80 bg-cyan-300/10 ring-2 ring-cyan-300/30"
                        : "border-white/15 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <span className="text-xl" aria-hidden>
                      {opt.emoji}
                    </span>
                    <span className="text-base font-semibold">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={!baseLevel}
              onClick={() => setPhase("quiz")}
              className="mt-6 w-full rounded-3xl bg-cyan-300 py-4 text-base font-bold text-slate-950 shadow-sm transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Empezar cuestionario
            </button>
          </motion.div>
        ) : null}

        {phase === "quiz" ? (
          <motion.div
            key={`quiz-${questionIndex}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.3 }}
            className="rounded-[2.2rem] border border-white/10 bg-[#020b1c] p-6 text-white"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200/90">
              {currentQuestion.title}
            </p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight">{currentQuestion.text}</h2>
            <div className="mt-6 flex flex-col gap-3">
              {QUIZ_ANSWER_OPTIONS.map((opt) => {
                const on = selectedAnswer === opt.score;
                return (
                  <button
                    key={opt.score}
                    type="button"
                    disabled={autoAdvancing}
                    onClick={() => handleSelectAnswer(opt.score)}
                    className={`w-full rounded-3xl border px-5 py-4 text-left transition ${
                      on
                        ? "border-cyan-300/90 bg-cyan-300/15 ring-2 ring-cyan-200/40"
                        : "border-white/15 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <p className="text-base font-semibold">{opt.label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-200/85">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (questionIndex === 0) {
                    setPhase("base");
                    return;
                  }
                  setQuestionIndex((prev) => prev - 1);
                }}
                className="flex-1 rounded-3xl border border-white/25 py-4 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                Atrás
              </button>
              <button
                type="button"
                disabled={!selectedAnswer || autoAdvancing}
                onClick={() => goToNextQuestion()}
                className="flex-1 rounded-3xl bg-cyan-300 py-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {questionIndex === QUIZ_QUESTIONS.length - 1 ? "Ir a ficha tecnica" : "Siguiente"}
              </button>
            </div>
          </motion.div>
        ) : null}

        {phase === "details" ? (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.3 }}
            className="rounded-[2.2rem] border border-white/10 bg-[#020b1c] p-6 text-white"
          >
            <h2 className="text-xl font-semibold">Ficha tecnica</h2>
            <p className="mt-1 text-sm text-slate-200/80">Ultimos datos antes de guardar</p>

            {computation ? (
              <div className="mt-5 space-y-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs text-slate-300">Categoria estimada segun tus respuestas</p>
                <p className="text-lg font-semibold tracking-tight">
                  {computation.category}{" "}
                  <span className="text-sm font-medium text-slate-300/90">
                    · {computation.afterPenalty.toFixed(2)}
                  </span>
                </p>
                {computation.category.includes("Elite") ? (
                  <p className="text-xs leading-relaxed text-slate-300/95">
                    Elite: puntuacion final entre 4,80 y 5,00 (tope del cuestionario).
                  </p>
                ) : null}
                {computation.penaltyApplied ? (
                  <p className="rounded-2xl bg-amber-200/10 px-3 py-2 text-xs leading-relaxed text-amber-100 ring-1 ring-amber-300/30">
                    Aplicamos un ajuste del 20%: la experiencia declarada no encaja con un nivel
                    tecnico muy alto.
                  </p>
                ) : null}
                {computation.selfAssessmentWarning ? (
                  <p className="rounded-2xl bg-sky-200/10 px-3 py-2 text-xs leading-relaxed text-sky-100 ring-1 ring-sky-300/30">
                    Tu autoevaluacion se aleja bastante del resto del cuestionario, pero igual
                    podes confirmar y guardar.
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
                      className={`flex-1 rounded-3xl border py-3 text-sm font-medium transition ${
                        hand === o.value
                          ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                          : "border-white/15 bg-white/5 text-slate-100 hover:border-white/30"
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
                      className={`flex-1 rounded-3xl border py-3 text-sm font-medium transition ${
                        position === o.value
                          ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                          : "border-white/15 bg-white/5 text-slate-100 hover:border-white/30"
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
                      className={`rounded-3xl border py-3 text-sm font-medium transition ${
                        schedule === o.value
                          ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                          : "border-white/15 bg-white/5 text-slate-100 hover:border-white/30"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error ? (
              <p className="mt-4 rounded-2xl bg-red-200/10 px-3 py-2 text-sm text-red-100 ring-1 ring-red-300/30">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setPhase("quiz")}
                className="flex-1 rounded-3xl border border-white/25 py-3.5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                Atrás
              </button>
              <button
                type="button"
                disabled={busy || !hand || !position || !schedule}
                onClick={() => void onSubmit()}
                className="flex-1 rounded-3xl bg-cyan-300 py-3.5 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Guardando..." : "Guardar perfil"}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
