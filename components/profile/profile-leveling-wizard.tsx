"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { completeLevelingProfile } from "@/app/(player)/perfil/leveling-actions";
import {
  QUIZ_QUESTION_OPTIONS,
  QUIZ_QUESTIONS,
  classifyCategory,
  computeLevelFromAnswers,
} from "@/lib/level-quiz-logic";

const ACCENT_BLUE = "bg-[#0461C4]";

export function ProfileLevelingWizard() {
  const router = useRouter();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    Array.from({ length: QUIZ_QUESTIONS.length }, () => null)
  );
  const [busy, setBusy] = useState(false);
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ average: number; category: string } | null>(null);

  const [phase, setPhase] = useState<"quiz" | "result">("quiz");
  const quizComplete = answers.every((a) => a !== null);
  const currentQuestion = QUIZ_QUESTIONS[questionIndex];
  const currentOptions = QUIZ_QUESTION_OPTIONS[questionIndex] ?? [];
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
      void onSubmit();
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
    if (!quizComplete) {
      setError("Completa todas las preguntas.");
      return;
    }
    setBusy(true);
    try {
      const res = await completeLevelingProfile({
        answers: answers as number[],
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      const average = res.level ?? Number((computation?.average ?? 0).toFixed(2));
      const category = res.category ?? classifyCategory(average);
      setResult({ average, category });
      setPhase("result");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-8" suppressHydrationWarning>
      <header className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.22)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0461C4]">
          FaltaUno
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Nivelacion paso a paso
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Una pregunta por pantalla para completar rapido desde el celular.
        </p>
        {phase !== "result" ? (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
              <span>Progreso</span>
              <span>
                {questionIndex + 1}/{QUIZ_QUESTIONS.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <motion.div
                className={`h-full rounded-full ${ACCENT_BLUE}`}
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.28, ease: "easeOut" }}
              />
            </div>
          </div>
        ) : null}
      </header>

      <AnimatePresence mode="wait">
        {phase === "quiz" ? (
          <motion.div
            key={`quiz-${questionIndex}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.3 }}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.22)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0461C4]">
              {currentQuestion.title}
            </p>
            <h2 className="mt-3 text-[1.65rem] font-semibold leading-tight text-slate-950">
              {currentQuestion.text}
            </h2>
            <div className="mt-6 flex flex-col gap-3">
              {currentOptions.map((opt) => {
                const on = selectedAnswer === opt.score;
                return (
                  <button
                    key={opt.score}
                    type="button"
                    disabled={autoAdvancing}
                    onClick={() => handleSelectAnswer(opt.score)}
                    className={`w-full rounded-3xl border bg-white px-5 py-4 text-left transition ${
                      on
                        ? "border-[#0585FC]/20 ring-2 ring-[#0585FC]/40"
                        : "border-slate-200 hover:border-[#0585FC]/30"
                    }`}
                  >
                    <p className="text-base font-semibold text-slate-900">{opt.text}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (questionIndex === 0) return;
                  setQuestionIndex((prev) => prev - 1);
                }}
                className="flex-1 rounded-3xl border border-slate-200 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={questionIndex === 0 || busy}
              >
                Atrás
              </button>
              <button
                type="button"
                disabled={!selectedAnswer || autoAdvancing || busy}
                onClick={() => goToNextQuestion()}
                className={`flex-1 rounded-3xl py-4 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${ACCENT_BLUE} hover:bg-[#0585FC]/50`}
              >
                {busy
                  ? "Guardando..."
                  : questionIndex === QUIZ_QUESTIONS.length - 1
                    ? "Finalizar"
                    : "Siguiente"}
              </button>
            </div>
            {error ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
          </motion.div>
        ) : null}

        {phase === "result" && result ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.3 }}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.22)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0461C4]">
              Nivelacion completada
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Perfil guardado con exito
            </h2>
            <div className="mt-4 rounded-3xl border border-slate-200 bg-[#F5F5F7] p-4">
              <p className="text-sm text-slate-600">Categoria estimada</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{result.category}</p>
              <p className="mt-2 text-sm text-slate-600">
                Este valor sale del promedio de tus 10 respuestas ({result.average.toFixed(2)} / 5).
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                router.push("/home?nivelacion=ok");
                router.refresh();
              }}
              className={`mt-6 w-full rounded-3xl py-4 text-base font-semibold text-white transition hover:bg-[#0585FC]/50 ${ACCENT_BLUE}`}
            >
              Guardar y Empezar
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
