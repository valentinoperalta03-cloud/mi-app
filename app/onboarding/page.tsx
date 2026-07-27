"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Space_Grotesk } from "next/font/google";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AppleToast } from "@/components/apple-toast";
import { ONBOARDING_QUESTIONS } from "@/lib/onboarding-quiz-data";
import {
  calculatePlayerLevel,
  levelCodeToNumeric,
  type OnboardingAnswers,
  type PlayerLevelCode,
} from "@/lib/onboarding-level-calculator";
import { classifyCategory } from "@/lib/level-quiz-logic";
import { completeOnboarding } from "./actions";
import { createClient } from "@/utils/supabase/client";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] });

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const TOTAL_QUESTIONS = ONBOARDING_QUESTIONS.length;

const PAGE_BACKGROUND =
  "linear-gradient(135deg, #0085FC 0%, #031733 60%, rgba(204,255,0,0.08) 100%)";

type Step = "profile" | "quiz" | "result";

const inputClass =
  "mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white placeholder:text-white/30 outline-none focus:border-brand-lima";

function OptionCard({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-left text-[15px] font-medium text-white transition-all duration-150 ${
        selected ? "border-brand-lima bg-[rgba(204,255,0,0.15)]" : "border-white/10 bg-white/[0.06]"
      }`}
    >
      <span>{label}</span>
      {selected ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-lima text-black">
          <Check size={14} strokeWidth={3} />
        </span>
      ) : null}
    </motion.button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>("profile");
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Paso 1 — perfil
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<"masculino" | "femenino" | "">("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredHand, setPreferredHand] = useState<"derecha" | "izquierda" | "ambas" | "">("");
  const [courtPosition, setCourtPosition] = useState<"drive" | "reves" | "ambas" | "">("");
  const [preferredSchedule, setPreferredSchedule] = useState<"manana" | "tarde" | "noche" | "cualquiera" | "">("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Quiz — 8 pantallas individuales, una por pregunta
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({});
  const [computedLevel, setComputedLevel] = useState<PlayerLevelCode | null>(null);

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

  function handleContinueFromProfile() {
    if (!firstName.trim() || !lastName.trim() || !gender || !preferredHand || !courtPosition || !preferredSchedule) {
      showToast("Completá todos los datos de tu perfil.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 8) {
      showToast("Ingresá un número de WhatsApp válido.");
      return;
    }
    setStep("quiz");
  }

  function selectAnswer(key: keyof OnboardingAnswers, value: string) {
    const nextAnswers = { ...answers, [key]: value } as Partial<OnboardingAnswers>;
    setAnswers(nextAnswers);

    window.setTimeout(() => {
      if (questionIndex < TOTAL_QUESTIONS - 1) {
        setQuestionIndex((i) => i + 1);
        return;
      }
      const level = calculatePlayerLevel(nextAnswers as OnboardingAnswers);
      setComputedLevel(level);
      setStep("result");
    }, 260);
  }

  function goBack() {
    if (questionIndex === 0) {
      setStep("profile");
      return;
    }
    const prevKey = ONBOARDING_QUESTIONS[questionIndex - 1].key;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[prevKey];
      return next;
    });
    setQuestionIndex((i) => i - 1);
  }

  function handleFinish() {
    startTransition(async () => {
      const res = await completeOnboarding({
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        gender: gender as "masculino" | "femenino",
        age: age.trim() === "" ? null : Number(age),
        avatarUrl: avatarUrl || null,
        preferredHand: preferredHand as "derecha" | "izquierda" | "ambas",
        courtPosition: courtPosition as "drive" | "reves" | "ambas",
        preferredSchedule: preferredSchedule as "manana" | "tarde" | "noche" | "cualquiera",
        phone: `+54${phone.replace(/\D/g, "")}`,
        answers: answers as OnboardingAnswers,
      });
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      router.replace("/home");
      router.refresh();
    });
  }

  const currentQuestion = ONBOARDING_QUESTIONS[questionIndex];
  const selectedValue = answers[currentQuestion.key];

  return (
    <main className="min-h-dvh" style={{ background: PAGE_BACKGROUND }}>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
        {step === "profile" ? (
          <div className="flex flex-1 flex-col">
            <h1 className={`${spaceGrotesk.className} text-2xl font-bold text-white`}>Contanos sobre vos</h1>
            <p className="mt-1 text-sm text-white/50">Esto nos ayuda a encontrarte los mejores partidos.</p>

            <div className="mt-6 flex-1 space-y-4 pb-6">
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]"
                >
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-white/40">Foto</span>
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
              <p className="text-center text-xs text-white/40">{uploadingAvatar ? "Subiendo foto…" : "Foto de perfil (opcional)"}</p>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-semibold text-white/60">Nombre</span>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Tu nombre" className={inputClass} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-white/60">Apellido</span>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Tu apellido" className={inputClass} />
                </label>
              </div>

              <div>
                <span className="text-xs font-semibold text-white/60">Género</span>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["masculino", "femenino"] as const).map((g) => (
                    <OptionCard key={g} label={g === "masculino" ? "Masculino" : "Femenino"} selected={gender === g} onClick={() => setGender(g)} />
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-white/60">Edad (opcional)</span>
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Ej. 28"
                  className={inputClass}
                />
              </label>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <span className="text-xs font-semibold text-white/60">Tu número de WhatsApp</span>
                <p className="mt-0.5 text-xs text-white/40">Los clubes pueden contactarte para coordinar tus reservas.</p>
                <div className="mt-2 flex gap-2">
                  <span className="flex items-center rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-[15px] font-medium text-white/70">
                    +54
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric"
                    placeholder="91122334455"
                    className={`${inputClass} mt-0 flex-1`}
                  />
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-white/60">Mano hábil</span>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {[
                    { id: "derecha", label: "Derecha" },
                    { id: "izquierda", label: "Izquierda" },
                    { id: "ambas", label: "Ambas" },
                  ].map((opt) => (
                    <OptionCard
                      key={opt.id}
                      label={opt.label}
                      selected={preferredHand === opt.id}
                      onClick={() => setPreferredHand(opt.id as "derecha" | "izquierda" | "ambas")}
                    />
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-white/60">Posición en cancha</span>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {[
                    { id: "drive", label: "Drive" },
                    { id: "reves", label: "Revés" },
                    { id: "ambas", label: "Ambas" },
                  ].map((opt) => (
                    <OptionCard
                      key={opt.id}
                      label={opt.label}
                      selected={courtPosition === opt.id}
                      onClick={() => setCourtPosition(opt.id as "drive" | "reves" | "ambas")}
                    />
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-white/60">Horario favorito</span>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {[
                    { id: "manana", label: "Mañana" },
                    { id: "tarde", label: "Tarde" },
                    { id: "noche", label: "Noche" },
                    { id: "cualquiera", label: "Cualquiera" },
                  ].map((opt) => (
                    <OptionCard
                      key={opt.id}
                      label={opt.label}
                      selected={preferredSchedule === opt.id}
                      onClick={() => setPreferredSchedule(opt.id as "manana" | "tarde" | "noche" | "cualquiera")}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleContinueFromProfile}
              className="w-full rounded-2xl bg-brand-lima py-3.5 text-base font-bold text-black shadow-[0_8px_24px_rgba(204,255,0,0.25)]"
            >
              Continuar
            </button>
          </div>
        ) : null}

        {step === "quiz" ? (
          <div className="flex flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={goBack}
                aria-label="Volver"
                className="flex shrink-0 items-center gap-1 py-1 text-xs font-medium text-white/40 transition hover:text-white/70"
              >
                <ChevronLeft size={16} />
                Volver
              </button>
              <div className="flex flex-1 gap-1.5">
                {ONBOARDING_QUESTIONS.map((_, i) => (
                  <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-brand-lima transition-all duration-300 ease-out"
                      style={{ width: i <= questionIndex ? "100%" : "0%" }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 shrink-0 text-right text-xs font-semibold uppercase tracking-wide text-white/40">
              {questionIndex + 1} de {TOTAL_QUESTIONS}
            </p>

            <div className="mt-6 flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={questionIndex}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="flex flex-col items-center text-center"
                >
                  <span className="text-6xl">{currentQuestion.emoji}</span>
                  <h2 className="mt-4 text-lg font-semibold leading-snug text-white">{currentQuestion.question}</h2>
                  <div className="mt-6 w-full space-y-2.5 text-left">
                    {currentQuestion.options.map((opt) => (
                      <OptionCard
                        key={opt.value}
                        label={opt.label}
                        selected={selectedValue === opt.value}
                        onClick={() => selectAnswer(currentQuestion.key, opt.value)}
                      />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        ) : null}

        {step === "result" && computedLevel ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-lima">Tu nivel inicial</p>
            <h1 className={`${spaceGrotesk.className} mt-3 text-4xl font-bold text-white`}>{computedLevel}</h1>
            <p className="mt-2 text-sm text-white/60">{classifyCategory(levelCodeToNumeric(computedLevel))}</p>
            <p className="mx-auto mt-5 max-w-xs text-sm leading-relaxed text-white/50">
              Calculamos tu nivel inicial con tus respuestas. A partir de ahora, tu ELO se ajusta solo después de cada
              partido que juegues.
            </p>
            <button
              type="button"
              onClick={handleFinish}
              disabled={pending}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-lima py-3.5 text-base font-bold text-black shadow-[0_8px_24px_rgba(204,255,0,0.25)] disabled:opacity-60"
            >
              {pending ? <Loader2 size={16} className="animate-spin" /> : null}
              Empezar a jugar
            </button>
          </div>
        ) : null}
      </div>
      <AppleToast message={toast} />
    </main>
  );
}
