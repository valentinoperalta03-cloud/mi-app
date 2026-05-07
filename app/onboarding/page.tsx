"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { AppleToast } from "@/components/apple-toast";
import {
  QUIZ_QUESTION_OPTIONS,
  QUIZ_QUESTIONS,
  classifyCategory,
  computeLevelFromAnswers,
  formatLevel,
} from "@/lib/level-quiz-logic";
import { completeOnboarding } from "./actions";
import { createClient } from "@/utils/supabase/client";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function categoryDescription(categoryLine: string): string {
  if (categoryLine.includes("1ra/2da")) return "Nivel competitivo alto con lectura táctica y ejecución avanzada.";
  if (categoryLine.includes("3ra")) return "Jugador avanzado con buena consistencia y definición.";
  if (categoryLine.includes("4ta")) return "Buen nivel técnico y táctico en partidos exigentes.";
  if (categoryLine.includes("5ta")) return "Intermedio alto con recursos para sostener ritmo.";
  if (categoryLine.includes("6ta")) return "Intermedio sólido con base técnica estable.";
  if (categoryLine.includes("7ma")) return "En desarrollo, consolidando fundamentos del juego.";
  return "Etapa inicial para construir técnica y táctica.";
}

export default function OnboardingPage({ defaultName = "" }: { defaultName?: string }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [quizIndex, setQuizIndex] = useState(0);
  const [name, setName] = useState(defaultName);
  const [gender, setGender] = useState<"masculino" | "femenino" | "">("");
  const [preferredHand, setPreferredHand] = useState<"derecha" | "izquierda" | "ambas" | "">("");
  const [courtPosition, setCourtPosition] = useState<"drive" | "reves" | "ambas" | "">("");
  const [preferredSchedule, setPreferredSchedule] = useState<"manana" | "tarde" | "noche" | "cualquiera" | "">("");
  const [age, setAge] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>(Array.from({ length: QUIZ_QUESTIONS.length }, () => null));
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const currentQuestion = QUIZ_QUESTIONS[quizIndex];
  const currentOptions = QUIZ_QUESTION_OPTIONS[quizIndex] ?? [];
  const selectedAnswer = answers[quizIndex];
  const quizProgress = ((quizIndex + 1) / QUIZ_QUESTIONS.length) * 100;

  const result = useMemo(() => {
    if (answers.some((a) => a == null)) return null;
    const numeric = answers as number[];
    const level = Number(computeLevelFromAnswers(numeric).average.toFixed(2));
    const category = formatLevel(level);
    return { level, category, description: categoryDescription(category) };
  }, [answers]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  }

  async function handleAvatarUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      showToast("Seleccioná una imagen válida.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showToast("La imagen supera 5MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        showToast("Iniciá sesión para continuar.");
        return;
      }
      const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type || "image/png",
      });
      if (error) {
        showToast(`No se pudo subir la foto: ${error.message}`);
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      const nextUrl = `${publicUrl}?v=${Date.now()}`;
      setAvatarUrl(nextUrl);
      setAvatarPreview(nextUrl);
    } finally {
      setUploadingAvatar(false);
    }
  }

  function onSelectAnswer(score: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[quizIndex] = score;
      return next;
    });
  }

  function onNextQuestion() {
    if (quizIndex >= QUIZ_QUESTIONS.length - 1) {
      setStep(3);
      return;
    }
    setQuizIndex((prev) => prev + 1);
  }

  function finishOnboarding() {
    if (!result) {
      showToast("Completá el quiz.");
      return;
    }
    startTransition(async () => {
      const ageNum = age.trim() === "" ? null : Number(age);
      const res = await completeOnboarding({
        name,
        gender: gender as "masculino" | "femenino",
        age: ageNum,
        avatarUrl: avatarUrl || null,
        preferred_hand: preferredHand as "derecha" | "izquierda" | "ambas",
        court_position: courtPosition as "drive" | "reves" | "ambas",
        preferred_schedule: preferredSchedule as "manana" | "tarde" | "noche" | "cualquiera",
        answers: answers as number[],
      });
      if (!res.ok) {
        const msg = String(res.message ?? "").toLowerCase();
        const canIgnoreLevelingError =
          msg.includes("nivelación") || msg.includes("nivelacion") || msg.includes("leveled");
        if (!canIgnoreLevelingError) {
          showToast(res.message);
          return;
        }
      }
      window.location.replace("/perfil");
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-5">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-[#0585FC]">Paso {step} de 3</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            {step === 1 ? "Tu perfil" : step === 2 ? "Tu nivel" : "Tu resultado"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === 1
              ? "Completá tus datos para personalizar tu experiencia."
              : step === 2
                ? "Respondé 10 preguntas para estimar tu ELO inicial."
                : "Ya tenés tu categoría inicial."}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#0585FC] to-[#0461C4]"
              initial={false}
              animate={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </header>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.section
              key="step-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-slate-100"
                >
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-slate-500">Foto</span>
                  )}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  await handleAvatarUpload(file);
                }}
              />
              <p className="mb-4 text-center text-xs text-slate-500">{uploadingAvatar ? "Subiendo foto..." : "Foto de perfil (opcional)"}</p>

              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Nombre completo</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#0585FC]"
                  placeholder="Tu nombre"
                />
              </label>

              <div className="mb-3">
                <p className="mb-2 text-sm font-medium text-slate-700">Género</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["masculino", "femenino"] as const).map((g) => {
                    const selected = gender === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                          selected ? "border-[#0585FC] bg-[#0585FC]/10 text-[#0461C4]" : "border-slate-200 text-slate-700"
                        }`}
                      >
                        {g === "masculino" ? "Masculino" : "Femenino"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="mb-5 block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Edad (opcional)</span>
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#0585FC]"
                  placeholder="Ej. 28"
                />
              </label>

              <div className="mb-3">
                <p className="mb-2 text-sm font-medium text-slate-700">Mano hábil</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "derecha", label: "Derecha" },
                    { id: "izquierda", label: "Izquierda" },
                    { id: "ambas", label: "Ambas" },
                  ].map((opt) => {
                    const selected = preferredHand === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPreferredHand(opt.id as "derecha" | "izquierda" | "ambas")}
                        className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                          selected ? "border-[#0585FC] bg-[#0585FC]/10 text-[#0461C4]" : "border-slate-200 text-slate-700"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-3">
                <p className="mb-2 text-sm font-medium text-slate-700">Posición en cancha</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "drive", label: "Drive" },
                    { id: "reves", label: "Revés" },
                    { id: "ambas", label: "Ambas" },
                  ].map((opt) => {
                    const selected = courtPosition === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCourtPosition(opt.id as "drive" | "reves" | "ambas")}
                        className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                          selected ? "border-[#0585FC] bg-[#0585FC]/10 text-[#0461C4]" : "border-slate-200 text-slate-700"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-5">
                <p className="mb-2 text-sm font-medium text-slate-700">Horario favorito</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "manana", label: "Mañana" },
                    { id: "tarde", label: "Tarde" },
                    { id: "noche", label: "Noche" },
                    { id: "cualquiera", label: "Cualquiera" },
                  ].map((opt) => {
                    const selected = preferredSchedule === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setPreferredSchedule(opt.id as "manana" | "tarde" | "noche" | "cualquiera")
                        }
                        className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                          selected ? "border-[#0585FC] bg-[#0585FC]/10 text-[#0461C4]" : "border-slate-200 text-slate-700"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!name.trim() || !gender || !preferredHand || !courtPosition || !preferredSchedule) {
                    showToast("Completá todos los datos del paso 1.");
                    return;
                  }
                  setStep(2);
                }}
                className="w-full rounded-2xl bg-gradient-to-r from-[#0585FC] to-[#0461C4] py-3 text-base font-semibold text-white shadow-[0_8px_24px_rgba(5,133,252,0.35)]"
              >
                Continuar
              </button>
            </motion.section>
          ) : null}

          {step === 2 ? (
            <motion.section
              key={`step-2-${quizIndex}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4">
                <p className="text-xs font-semibold text-[#0585FC]">
                  Pregunta {quizIndex + 1} de {QUIZ_QUESTIONS.length}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <motion.div
                    className="h-full rounded-full bg-[#0585FC]"
                    initial={false}
                    animate={{ width: `${quizProgress}%` }}
                  />
                </div>
              </div>

              <p className="mb-1 text-sm text-slate-500">{currentQuestion.title}</p>
              <h2 className="mb-4 text-xl font-bold text-slate-950">{currentQuestion.text}</h2>
              <p className="mb-4 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                Tu nivel ELO es un número que refleja tu habilidad real en cancha. Empieza con este quiz y sube
                automáticamente al ganar partidos. Mientras más ganás contra rivales de mayor nivel, más sube.
              </p>

              <div className="space-y-2">
                {currentOptions.map((opt) => {
                  const selected = selectedAnswer === opt.score;
                  return (
                    <button
                      key={opt.score}
                      type="button"
                      onClick={() => onSelectAnswer(opt.score)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        selected ? "border-[#0585FC] bg-[#0585FC]/10" : "border-slate-200 bg-white"
                      }`}
                    >
                      <span className="font-medium text-slate-800">{opt.text}</span>
                      {selected ? <CheckCircle2 size={18} className="text-[#0461C4]" /> : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (quizIndex === 0) {
                      setStep(1);
                      return;
                    }
                    setQuizIndex((prev) => prev - 1);
                  }}
                  className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-700"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  disabled={selectedAnswer == null}
                  onClick={onNextQuestion}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0585FC] to-[#0461C4] py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {quizIndex === QUIZ_QUESTIONS.length - 1 ? "Ver resultado" : "Siguiente"} <ChevronRight size={16} />
                </button>
              </div>
            </motion.section>
          ) : null}

          {step === 3 ? (
            <motion.section
              key="step-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-xl font-bold text-slate-950">Tu categoría inicial</h2>
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mt-4 rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/5 p-4"
              >
                <p className="text-sm text-slate-500">Categoría</p>
                <p className="text-2xl font-bold text-[#0461C4]">{result?.category ?? "Sin categoría"}</p>
                <p className="mt-2 text-sm text-slate-500">Nivel ELO</p>
                <p className="text-2xl font-bold text-slate-900">{result?.level.toFixed(2) ?? "0.00"}</p>
                <p className="mt-2 text-sm text-slate-600">{result?.description}</p>
              </motion.div>

              <button
                type="button"
                onClick={finishOnboarding}
                disabled={pending}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0585FC] to-[#0461C4] py-3 text-base font-semibold text-white shadow-[0_8px_24px_rgba(5,133,252,0.35)] disabled:opacity-60"
              >
                {pending ? <Loader2 size={16} className="animate-spin" /> : null}
                ¡Empezar a jugar!
              </button>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
      <AppleToast message={toast} />
    </main>
  );
}
