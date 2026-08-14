"use client";

import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import Image from "next/image";
import { Camera, Check, ChevronLeft, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { AppleToast } from "@/components/apple-toast";
import { firebaseAuth } from "@/lib/firebase";
import { createClient } from "@/utils/supabase/client";
import { completarPerfilAction } from "./actions";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const OTP_COOLDOWN_SECONDS = 30;

const CATEGORIES: { value: string; description: string }[] = [
  { value: "8va", description: "Recién empezás a jugar" },
  { value: "7ma", description: "Jugás hace poco, golpes básicos" },
  { value: "6ta", description: "Jugás seguido, conocés el juego" },
  { value: "5ta", description: "Buen nivel, jugás torneos barriales" },
  { value: "4ta", description: "Nivel competitivo, torneos de club" },
  { value: "3ra", description: "Alto nivel, torneos provinciales" },
  { value: "2da", description: "Jugador destacado, torneos regionales" },
  { value: "1ra", description: "Jugador de élite, torneos nacionales" },
];

const labelClass = `${ibmPlexMono.className} text-[11px] font-semibold uppercase tracking-[0.12em] text-[#CCFF00]`;

function Chip({
  label,
  selected,
  onClick,
  minHeight = 52,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  minHeight?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ minHeight }}
      className={`flex flex-1 items-center justify-center rounded-[10px] border px-3 text-sm font-semibold transition-colors ${
        selected
          ? "border-[#0085FC] bg-[#0085FC] text-white"
          : "border-white/15 bg-white/[0.06] text-white/70"
      }`}
    >
      {label}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-5">
      <div className="space-y-4">{children}</div>
    </section>
  );
}

type StepStatus = "active" | "completed" | "pending";

function StepCircle({ status, number }: { status: StepStatus; number: number }) {
  if (status === "completed") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#CCFF00] text-black">
        <Check size={16} strokeWidth={3} />
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0085FC] text-sm font-bold text-white">
        {number}
      </div>
    );
  }
  return (
    <div className="h-9 w-9 shrink-0 rounded-full border border-white/30 bg-transparent" />
  );
}

function ProgressIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <StepCircle status={step === 1 ? "active" : "completed"} number={1} />
      <div className={`h-0.5 w-14 rounded-full ${step === 2 ? "bg-[#CCFF00]" : "bg-white/20"}`} />
      <StepCircle status={step === 2 ? "active" : "pending"} number={2} />
    </div>
  );
}

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? "-100%" : "100%", opacity: 0 }),
};

export default function CompletarPerfilClient() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState(1);

  // Pantalla 1 — sobre vos
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"masculino" | "femenino" | "">("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Pantalla 2 — tu juego
  const [preferredHand, setPreferredHand] = useState<"derecha" | "izquierda" | "ambas" | "">("");
  const [courtPosition, setCourtPosition] = useState<"drive" | "reves" | "ambas" | "">("");
  const [preferredSchedule, setPreferredSchedule] = useState<"manana" | "tarde" | "noche" | "cualquiera" | "">("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  // El div#recaptcha-container se renderiza siempre, fuera de los bloques
  // condicionales por paso, para que nunca se desmonte del DOM mientras el
  // usuario navega entre pantallas — RecaptchaVerifier exige que el
  // elemento exista en el DOM al construirse y se rompe si el nodo al que
  // apunta queda desmontado.
  useEffect(() => {
    console.log("[Firebase] Inicializando RecaptchaVerifier...");
    recaptchaVerifierRef.current = new RecaptchaVerifier(firebaseAuth, "recaptcha-container", {
      size: "invisible",
      callback: () => {
        console.log("[Firebase] reCAPTCHA resuelto.");
      },
      "expired-callback": () => {
        console.log("[Firebase] reCAPTCHA expirado.");
      },
    });
    console.log("[Firebase] RecaptchaVerifier inicializado.");

    return () => {
      console.log("[Firebase] Limpiando RecaptchaVerifier...");
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
    };
  }, []);

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

  async function handleSendCode() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) {
      showToast("Ingresá un número de teléfono válido.");
      return;
    }
    const verifier = recaptchaVerifierRef.current;
    if (!verifier) {
      console.error("[Firebase] RecaptchaVerifier no está inicializado todavía.");
      showToast("Todavía se está cargando la verificación. Esperá un segundo e intentá de nuevo.");
      return;
    }
    const fullPhone = `+54${digits}`;
    setSendingCode(true);
    try {
      console.log("[Firebase] signInWithPhoneNumber llamado con:", fullPhone);
      const result = await signInWithPhoneNumber(firebaseAuth, fullPhone, verifier);
      console.log("[Firebase] SMS enviado, esperando código.");
      confirmationRef.current = result;
      setOtpSent(true);
      setOtpCode("");
      setCooldown(OTP_COOLDOWN_SECONDS);
      showToast("Te enviamos un código por SMS.");
    } catch (error) {
      console.error("[Firebase] Error:", error);
      showToast("No se pudo enviar el SMS. Verificá el número e intentá de nuevo.");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerifyCode() {
    if (!confirmationRef.current) return;
    if (otpCode.length !== 6) {
      showToast("Ingresá el código de 6 dígitos.");
      return;
    }
    setVerifyingCode(true);
    try {
      console.log("[Firebase] Verificando código OTP...");
      await confirmationRef.current.confirm(otpCode);
      console.log("[Firebase] Código verificado correctamente.");
      setPhoneVerified(true);
      showToast("Teléfono verificado.");
    } catch (error) {
      console.error("[Firebase] Error:", error);
      showToast("Código incorrecto o expirado. Probá de nuevo.");
    } finally {
      setVerifyingCode(false);
    }
  }

  const canSubmitStep1 = Boolean(name.trim() && gender && phoneVerified);
  const canSubmitStep2 = Boolean(preferredHand && courtPosition && preferredSchedule && category);

  function goToStep2() {
    if (!canSubmitStep1) return;
    setDirection(1);
    setStep(2);
  }

  function goToStep1() {
    setDirection(-1);
    setStep(1);
  }

  function handleFinish() {
    if (!canSubmitStep2) return;
    startTransition(async () => {
      const res = await completarPerfilAction({
        name: name.trim(),
        gender: gender as "masculino" | "femenino",
        avatarUrl: avatarUrl || null,
        preferredHand: preferredHand as "derecha" | "izquierda" | "ambas",
        courtPosition: courtPosition as "drive" | "reves" | "ambas",
        preferredSchedule: preferredSchedule as "manana" | "tarde" | "noche" | "cualquiera",
        category,
        phone: `+54${phone.replace(/\D/g, "")}`,
      });
      if (res && !res.ok) {
        showToast(res.message);
      }
    });
  }

  return (
    <main
      className="min-h-dvh"
      style={{ background: "linear-gradient(135deg, #0C1829 0%, #0A2540 100%)" }}
    >
      <div className="h-0.5 w-full bg-[#CCFF00]" />
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-6 overflow-y-auto px-5 py-6">
        <div className="flex flex-col items-center gap-5">
          <Image src="/logo.png" alt="PadeLibre" width={32} height={32} className="rounded-lg" />
          <ProgressIndicator step={step} />
        </div>

        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            {step === 1 ? (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                className="flex flex-col gap-6"
              >
                <div className="text-center">
                  <h1 className={`${spaceGrotesk.className} text-[26px] font-bold text-white`}>
                    Contanos sobre vos
                  </h1>
                  <p className="mt-1.5 text-sm text-white/60">
                    Solo te pedimos esto una vez. Después siempre entrás directo.
                  </p>
                </div>

                <Card>
                  <span className={labelClass}>¿Cómo te llamás?</span>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/[0.06]"
                    >
                      {avatarPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <Camera size={22} className="text-white/40" />
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
                  <p className="text-center text-xs text-white/40">
                    {uploadingAvatar ? "Subiendo foto…" : "Agregar foto (opcional)"}
                  </p>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre completo"
                    className="w-full rounded-[10px] border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white placeholder:text-white/30 outline-none focus:border-[#0085FC]"
                  />
                </Card>

                <Card>
                  <span className={labelClass}>¿Cuál es tu género?</span>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setGender("masculino")}
                      style={{ minHeight: 56 }}
                      className={`w-full rounded-[10px] border text-[15px] font-semibold transition-colors ${
                        gender === "masculino"
                          ? "border-[#0085FC] bg-[#0085FC] text-white"
                          : "border-white/15 bg-white/[0.06] text-white/70"
                      }`}
                    >
                      ♂ Masculino
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender("femenino")}
                      style={{ minHeight: 56 }}
                      className={`w-full rounded-[10px] border text-[15px] font-semibold transition-colors ${
                        gender === "femenino"
                          ? "border-[#0085FC] bg-[#0085FC] text-white"
                          : "border-white/15 bg-white/[0.06] text-white/70"
                      }`}
                    >
                      ♀ Femenino
                    </button>
                  </div>
                </Card>

                <Card>
                  <span className={labelClass}>¿Cuál es tu número de WhatsApp?</span>
                  <p className="text-[13px] leading-relaxed text-white/55">
                    El club puede contactarte si tiene alguna novedad sobre tu reserva o partido.
                  </p>

                  {!phoneVerified ? (
                    <>
                      <div className="flex gap-2">
                        <span className="flex items-center rounded-[10px] border border-white/10 bg-white/[0.06] px-3 text-[15px] font-medium text-white/70">
                          +54
                        </span>
                        <input
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value.replace(/[^0-9]/g, ""));
                            setOtpSent(false);
                          }}
                          inputMode="numeric"
                          placeholder="91122334455"
                          disabled={otpSent}
                          className="flex-1 rounded-[10px] border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white placeholder:text-white/30 outline-none focus:border-[#0085FC] disabled:opacity-50"
                        />
                      </div>

                      {!otpSent ? (
                        <button
                          type="button"
                          onClick={() => void handleSendCode()}
                          disabled={sendingCode}
                          style={{ minHeight: 52 }}
                          className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {sendingCode ? <Loader2 size={16} className="animate-spin" /> : null}
                          Enviar código
                        </button>
                      ) : (
                        <>
                          <input
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="123456"
                            className="w-full rounded-[10px] border border-white/10 bg-white/[0.06] px-4 py-4 text-center text-2xl tracking-[0.3em] text-white placeholder:text-white/20 outline-none focus:border-[#0085FC]"
                          />
                          <button
                            type="button"
                            onClick={() => void handleVerifyCode()}
                            disabled={verifyingCode || otpCode.length !== 6}
                            style={{ minHeight: 52 }}
                            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {verifyingCode ? <Loader2 size={16} className="animate-spin" /> : null}
                            Verificar
                          </button>
                          <button
                            type="button"
                            disabled={cooldown > 0 || sendingCode}
                            onClick={() => void handleSendCode()}
                            className="w-full text-center text-xs font-semibold text-[#0085FC] disabled:opacity-40"
                          >
                            {cooldown > 0 ? `Reenviar código en ${cooldown}s` : "Reenviar código"}
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 rounded-[10px] border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-3 text-sm font-semibold text-emerald-300">
                      <Check size={16} strokeWidth={3} />
                      Teléfono verificado
                    </div>
                  )}
                </Card>

                <button
                  type="button"
                  onClick={goToStep2}
                  disabled={!canSubmitStep1}
                  style={{ minHeight: 52 }}
                  className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-base font-bold text-white shadow-[0_8px_24px_rgba(0,133,252,0.25)] disabled:opacity-40"
                >
                  Continuar →
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                className="flex flex-col gap-6"
              >
                <button
                  type="button"
                  onClick={goToStep1}
                  className="flex items-center gap-1 self-start text-sm font-medium text-white/50 transition hover:text-white/80"
                >
                  <ChevronLeft size={16} />
                  Volver
                </button>

                <div className="text-center">
                  <h1 className={`${spaceGrotesk.className} text-[26px] font-bold text-white`}>¿Cómo jugás?</h1>
                  <p className="mt-1.5 text-sm text-white/60">
                    Esto nos ayuda a encontrarte los mejores partidos.
                  </p>
                </div>

                <Card>
                  <span className={labelClass}>Mano hábil</span>
                  <div className="flex gap-2">
                    {[
                      { id: "derecha", label: "Derecha" },
                      { id: "izquierda", label: "Izquierda" },
                      { id: "ambas", label: "Ambas" },
                    ].map((opt) => (
                      <Chip
                        key={opt.id}
                        label={opt.label}
                        selected={preferredHand === opt.id}
                        onClick={() => setPreferredHand(opt.id as "derecha" | "izquierda" | "ambas")}
                      />
                    ))}
                  </div>
                </Card>

                <Card>
                  <span className={labelClass}>Posición en cancha</span>
                  <div className="flex gap-2">
                    {[
                      { id: "drive", label: "Drive" },
                      { id: "reves", label: "Revés" },
                      { id: "ambas", label: "Ambas" },
                    ].map((opt) => (
                      <Chip
                        key={opt.id}
                        label={opt.label}
                        selected={courtPosition === opt.id}
                        onClick={() => setCourtPosition(opt.id as "drive" | "reves" | "ambas")}
                      />
                    ))}
                  </div>
                </Card>

                <Card>
                  <span className={labelClass}>Horario favorito</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "manana", label: "Mañana" },
                      { id: "tarde", label: "Tarde" },
                      { id: "noche", label: "Noche" },
                      { id: "cualquiera", label: "Cualquiera" },
                    ].map((opt) => (
                      <Chip
                        key={opt.id}
                        label={opt.label}
                        selected={preferredSchedule === opt.id}
                        onClick={() => setPreferredSchedule(opt.id as "manana" | "tarde" | "noche" | "cualquiera")}
                      />
                    ))}
                  </div>
                </Card>

                <Card>
                  <span className={labelClass}>Tu categoría</span>
                  <div className="rounded-[10px] border-l-[3px] border-[#FFC107] bg-[rgba(255,193,7,0.12)] px-3.5 py-3 text-xs leading-relaxed text-amber-100">
                    Elegí con honestidad. Si mentís, no vas a poder unirte a partidos con tus amigos ni a
                    torneos de tu nivel.
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {CATEGORIES.map((opt) => (
                      <Chip
                        key={opt.value}
                        label={opt.value}
                        selected={category === opt.value}
                        onClick={() => setCategory(opt.value)}
                        minHeight={44}
                      />
                    ))}
                  </div>
                  {category ? (
                    <p className="text-xs text-white/50">
                      {CATEGORIES.find((c) => c.value === category)?.description}
                    </p>
                  ) : null}
                </Card>

                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={!canSubmitStep2 || pending}
                  style={{ minHeight: 52 }}
                  className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-base font-bold text-white shadow-[0_8px_24px_rgba(0,133,252,0.25)] disabled:opacity-40"
                >
                  {pending ? <Loader2 size={16} className="animate-spin" /> : null}
                  Guardar y empezar a jugar 🎾
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div id="recaptcha-container" />
      <AppleToast message={toast} />
    </main>
  );
}
