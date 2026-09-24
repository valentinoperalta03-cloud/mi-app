"use client";

import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import Image from "next/image";
import {
  ArrowLeft,
  Camera,
  Check,
  CircleAlert,
  Clock3,
  Loader2,
  Mars,
  Moon,
  Pencil,
  Phone,
  Sun,
  Sunrise,
  Venus,
} from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { AppleToast } from "@/components/apple-toast";
import { ARGENTINA_PROVINCES } from "@/lib/argentina-provinces";
import { arMobileInputValue, arMobileProblem, formatArMobile, normalizeArMobile } from "@/lib/phone-ar";
import { createClient } from "@/utils/supabase/client";
import { completarPerfilAction } from "./actions";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"] });

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const INK = "#06101E";
const LIME = "#CCFF00";
const BLUE = "#0085FC";
const BLUE_DEEP = "#0461C4";

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

const HAND_OPTIONS = [
  { id: "derecha" as const, label: "Diestro", sub: "Mano derecha", mirror: false },
  { id: "izquierda" as const, label: "Zurdo", sub: "Mano izquierda", mirror: true },
];

const POSITION_OPTIONS = [
  { id: "drive" as const, label: "Drive", sub: "Lado derecho" },
  { id: "reves" as const, label: "Revés", sub: "Lado izquierdo" },
  { id: "ambas" as const, label: "Indistinto", sub: "Cualquier lado" },
];

const GENDER_OPTIONS = [
  { id: "masculino" as const, label: "Caballeros", sub: "Categorías masculinas", Icon: Mars },
  { id: "femenino" as const, label: "Damas", sub: "Categorías femeninas", Icon: Venus },
];

const SCHEDULE_OPTIONS = [
  { id: "manana" as const, label: "Mañana", Icon: Sunrise },
  { id: "tarde" as const, label: "Tarde", Icon: Sun },
  { id: "noche" as const, label: "Noche", Icon: Moon },
  { id: "cualquiera" as const, label: "Cualquiera", Icon: Clock3 },
];

const STEPS = {
  1: { title: "Datos personales", subtitle: "Así te van a ver los otros jugadores." },
  2: { title: "Estilo de juego", subtitle: "Con esto armamos partidos más parejos." },
  3: { title: "Perfil deportivo", subtitle: "Tu categoría define con quién vas a jugar." },
  4: {
    title: "Que tu club pueda contactarte cuando lo necesite.",
    subtitle:
      "Si surge algún inconveniente con tu reserva o hay un cambio en tu horario, el club puede necesitar comunicarse con vos. Asegurate de ingresar tu número real.",
  },
  5: { title: "Tu perfil está listo", subtitle: "Revisá que todo esté bien y empezá a jugar." },
} as const;

type Step = 1 | 2 | 3 | 4 | 5;

function calcularEdad(fechaNacimiento: string): number | null {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  if (Number.isNaN(nac.getTime())) return null;
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad > 0 && edad < 120 ? edad : null;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#CCFF00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06101E]";
// globals.css estiliza input/select sin @layer (le gana a Tailwind); esta clase
// con mayor especificidad mantiene la estética oscura del onboarding.
const fieldClass = "cp-field h-14 w-full rounded-2xl border px-4 text-[16px] outline-none transition-colors disabled:opacity-40";
const FIELD_CSS = `.cp-field{background-color:rgba(255,255,255,.05);border-color:rgba(255,255,255,.1);color:#fff}
.cp-field:focus{border-color:#CCFF00;background-color:rgba(255,255,255,.07)}
.cp-field::placeholder{color:rgba(255,255,255,.3)}
.cp-field[aria-invalid="true"]{border-color:rgba(255,107,107,.6)}`;

// ── Piezas visuales ──────────────────────────────────────────────────────────

function PadelBall({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="7.5" fill={LIME} />
      <path d="M2.2 4.2c2.6 1.2 2.6 6.4 0 7.6M13.8 4.2c-2.6 1.2-2.6 6.4 0 7.6" stroke={INK} strokeOpacity=".35" strokeWidth="1.1" fill="none" />
    </svg>
  );
}

function Progress({ step }: { step: Step }) {
  return (
    <div
      className="relative h-4"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={5}
      aria-valuenow={step}
      aria-label={`Paso ${step} de 5`}
    >
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.10]">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: LIME }}
              initial={false}
              animate={{ width: i < step ? "100%" : i === step ? "50%" : "0%" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        ))}
      </div>
      <motion.div
        className="absolute top-0 -ml-2"
        initial={false}
        animate={{ left: `${(2 * step - 1) * 10}%`, rotate: step * 180 }}
        transition={{ type: "spring", stiffness: 180, damping: 20 }}
        style={{ filter: "drop-shadow(0 0 6px rgba(204,255,0,0.55))" }}
      >
        <PadelBall />
      </motion.div>
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[24px] border border-white/[0.08] p-5 ${className}`}
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {children}
    </section>
  );
}

function PanelLabel({ children, htmlFor, id }: { children: React.ReactNode; htmlFor?: string; id?: string }) {
  const cls = "mb-3 block text-[14px] font-semibold text-white/75";
  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls}>
      {children}
    </label>
  ) : (
    <p id={id} className={cls}>
      {children}
    </p>
  );
}

function SelectedBadge({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 26 }}
          className="absolute right-1.5 top-1.5 flex size-[18px] items-center justify-center rounded-full"
          style={{ backgroundColor: LIME }}
        >
          <Check size={12} strokeWidth={3.2} color={INK} />
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

function OptionTile({
  selected,
  onClick,
  children,
  className = "",
  badge = true,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  badge?: boolean;
}) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`relative flex flex-col items-center justify-center rounded-2xl border text-center transition-colors duration-200 ${focusRing} ${
        selected
          ? "border-[#CCFF00] bg-[#CCFF00]/[0.08] text-white"
          : "border-white/[0.10] bg-white/[0.03] text-white/80 hover:border-white/[0.20] hover:bg-white/[0.06]"
      } ${className}`}
    >
      {badge ? <SelectedBadge show={selected} /> : null}
      {children}
    </motion.button>
  );
}

function RacketGlyph({ mirror, active }: { mirror: boolean; active: boolean }) {
  return (
    <svg
      width="46"
      height="46"
      viewBox="0 0 48 48"
      aria-hidden
      style={{ transform: mirror ? "scaleX(-1)" : undefined }}
      className={active ? "text-[#CCFF00]" : "text-white/55"}
    >
      <g transform="rotate(28 24 24)">
        <ellipse cx="24" cy="16" rx="11" ry="12.5" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="2.4" />
        {[
          [20, 11],
          [24, 11],
          [28, 11],
          [18, 16],
          [22, 16],
          [26, 16],
          [30, 16],
          [20, 21],
          [24, 21],
          [28, 21],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />
        ))}
        <path d="M21 28h6l-1 4h-4z" fill="currentColor" />
        <rect x="22" y="31" width="4" height="14" rx="2" fill="currentColor" />
      </g>
    </svg>
  );
}

function CourtGlyph({ side, active }: { side: "drive" | "reves" | "ambas"; active: boolean }) {
  const tone = active ? LIME : "rgba(255,255,255,0.55)";
  const zones = side === "ambas" ? ["reves", "drive"] : [side];
  return (
    <svg width="58" height="44" viewBox="0 0 60 46" aria-hidden>
      {zones.map((z) => (
        <rect
          key={z}
          x={z === "reves" ? 3 : 30}
          y="4"
          width="27"
          height="39"
          fill={tone}
          fillOpacity={side === "ambas" ? 0.14 : 0.24}
        />
      ))}
      <rect x="3" y="4" width="54" height="39" rx="2" fill="none" stroke={tone} strokeWidth="1.6" />
      <line x1="3" y1="4" x2="57" y2="4" stroke={tone} strokeWidth="3" />
      <line x1="3" y1="27" x2="57" y2="27" stroke={tone} strokeWidth="1.2" />
      <line x1="30" y1="4" x2="30" y2="27" stroke={tone} strokeWidth="1.2" />
      {zones.map((z) => (
        <circle key={`p-${z}`} cx={z === "reves" ? 16.5 : 43.5} cy="35" r="3.2" fill={tone} />
      ))}
    </svg>
  );
}

function LevelMeter({ level, compact }: { level: number; compact?: boolean }) {
  return (
    <div className={`flex items-end ${compact ? "h-4 gap-[3px]" : "h-6 gap-1"}`} aria-hidden>
      {CATEGORIES.map((_, i) => (
        <motion.span
          key={i}
          className={`rounded-sm ${compact ? "w-[4px]" : "w-[6px]"}`}
          initial={false}
          animate={{ backgroundColor: i < level ? LIME : "rgba(255,255,255,0.14)" }}
          transition={{ delay: i * 0.025 }}
          style={{ height: `${30 + (i / (CATEGORIES.length - 1)) * 70}%` }}
        />
      ))}
    </div>
  );
}

function PrimaryButton({
  enabled,
  pending,
  onClick,
  children,
}: {
  enabled: boolean;
  pending?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const active = enabled && !pending;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!active}
      aria-busy={pending || undefined}
      whileTap={active ? { scale: 0.98 } : {}}
      animate={{
        backgroundColor: active || pending ? LIME : "rgba(255,255,255,0.08)",
        color: active || pending ? INK : "rgba(255,255,255,0.35)",
        boxShadow: active ? "0 10px 30px -10px rgba(204,255,0,0.55)" : "0 0 0 rgba(0,0,0,0)",
      }}
      transition={{ duration: 0.2 }}
      className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-[16px] font-bold disabled:cursor-not-allowed ${focusRing}`}
    >
      {pending ? <Loader2 size={20} className="animate-spin" /> : children}
    </motion.button>
  );
}

function AvatarCircle({ src, size, ring = "rgba(204,255,0,0.5)" }: { src: string | null; size: number; ring?: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-full bg-white/[0.06]"
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${ring}` }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Tu foto de perfil" className="h-full w-full object-cover" />
      ) : (
        <svg viewBox="0 0 64 64" className="h-full w-full text-white/25" aria-hidden>
          <circle cx="32" cy="25" r="11" fill="currentColor" />
          <path d="M12 58c2-11 10-17 20-17s18 6 20 17" fill="currentColor" />
        </svg>
      )}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function CompletarPerfilClient({
  next,
  googleAvatarUrl,
  initialPhone,
}: {
  next?: string;
  googleAvatarUrl?: string | null;
  initialPhone?: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState(1);

  // Paso 1 — Datos personales
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(googleAvatarUrl ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(googleAvatarUrl ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Paso 2 — Estilo de juego
  const [preferredHand, setPreferredHand] = useState<"derecha" | "izquierda" | "">("");
  const [courtPosition, setCourtPosition] = useState<"drive" | "reves" | "ambas" | "">("");
  const [preferredSchedule, setPreferredSchedule] = useState<
    "manana" | "tarde" | "noche" | "cualquiera" | ""
  >("");

  // Paso 3 — Perfil deportivo
  const [gender, setGender] = useState<"masculino" | "femenino" | "">("");
  const [category, setCategory] = useState("");

  // Paso 4 — Contacto. El jugador confirma el número normalizado; es una
  // declaración suya, no una verificación de propiedad. `confirmedPhone` es el
  // E.164 que confirmó: si el input cambia, deja de coincidir y hay que
  // confirmar de nuevo.
  const [phoneInput, setPhoneInput] = useState(arMobileInputValue(initialPhone));
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [confirmedPhone, setConfirmedPhone] = useState<string | null>(null);
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");

  const edad = calcularEdad(birthDate);
  const normalizedPhone = useMemo(() => normalizeArMobile(phoneInput), [phoneInput]);
  const isConfirmed = Boolean(confirmedPhone && normalizedPhone === confirmedPhone);
  const phoneView: "confirmed" | "review" | "input" = isConfirmed
    ? "confirmed"
    : reviewing && normalizedPhone
      ? "review"
      : "input";
  // Sin errores a cada tecla: el problema se muestra al salir del campo.
  const phoneProblem = phoneTouched && !normalizedPhone ? arMobileProblem(phoneInput) : null;

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
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
        showToast("No pudimos subir la foto. Probá con otra imagen.");
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

  function reviewPhone() {
    setPhoneTouched(true);
    if (normalizedPhone) setReviewing(true);
  }

  function confirmPhone() {
    if (!normalizedPhone) return;
    setConfirmedPhone(normalizedPhone);
    setReviewing(false);
  }

  function editPhone() {
    setConfirmedPhone(null);
    setReviewing(false);
    window.setTimeout(() => phoneInputRef.current?.focus(), 50);
  }

  const canStep1 = Boolean(name.trim() && birthDate && edad !== null);
  const canStep2 = Boolean(preferredHand && courtPosition && preferredSchedule);
  const canStep3 = Boolean(gender && category);
  const canStep4 = Boolean(isConfirmed && province);
  const canContinue = step === 1 ? canStep1 : step === 2 ? canStep2 : step === 3 ? canStep3 : step === 4 ? canStep4 : true;

  const blockedHint =
    step === 1
      ? !name.trim()
        ? "Ingresá tu nombre para continuar."
        : edad === null
          ? "Ingresá tu fecha de nacimiento."
          : null
      : step === 2
        ? "Elegí mano hábil, posición y horario."
        : step === 3
          ? "Elegí género y categoría."
          : step === 4
            ? !normalizedPhone
              ? "Ingresá tu número de celular."
              : !isConfirmed
                ? "Confirmá que tu número es correcto."
                : "Seleccioná tu provincia."
            : null;

  function goTo(target: Step) {
    setDirection(target > step ? 1 : -1);
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goNext() {
    if (!canContinue || step === 5) return;
    goTo((step + 1) as Step);
  }

  function goBack() {
    if (step > 1) goTo((step - 1) as Step);
  }

  function handleFinish() {
    if (!confirmedPhone || !isConfirmed) {
      goTo(4);
      return;
    }
    startTransition(async () => {
      const res = await completarPerfilAction({
        name: name.trim(),
        age: edad,
        gender: gender as "masculino" | "femenino",
        avatarUrl: avatarUrl || null,
        preferredHand: preferredHand as "derecha" | "izquierda",
        courtPosition: courtPosition as "drive" | "reves" | "ambas",
        preferredSchedule: preferredSchedule as "manana" | "tarde" | "noche" | "cualquiera",
        category,
        phone: confirmedPhone,
        phoneConfirmed: true,
        province,
        city: city.trim(),
        next: next || null,
      });
      if (res && !res.ok) {
        showToast(res.message);
      }
    });
  }

  const categoryIndex = CATEGORIES.findIndex((c) => c.value === category);
  const categoryLevel = categoryIndex >= 0 ? categoryIndex + 1 : 0;
  const cities = ARGENTINA_PROVINCES.find((prov) => prov.name === province)?.cities ?? [];

  const summaryRows: { label: string; value: string; step: Step }[] = [
    { label: "Mano hábil", value: HAND_OPTIONS.find((o) => o.id === preferredHand)?.label ?? "", step: 2 },
    { label: "Posición", value: POSITION_OPTIONS.find((o) => o.id === courtPosition)?.label ?? "", step: 2 },
    { label: "Horario", value: SCHEDULE_OPTIONS.find((o) => o.id === preferredSchedule)?.label ?? "", step: 2 },
    { label: "Rama", value: GENDER_OPTIONS.find((o) => o.id === gender)?.label ?? "", step: 3 },
    { label: "Zona", value: [city, province].filter(Boolean).join(", "), step: 4 },
    { label: "Teléfono", value: confirmedPhone ? formatArMobile(confirmedPhone) : "", step: 4 },
  ];

  const slide = {
    enter: (d: number) => ({ x: d * 28, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -28, opacity: 0 }),
  };

  return (
    <MotionConfig reducedMotion="user">
      <style>{FIELD_CSS}</style>
      <main
        className={`${spaceGrotesk.className} relative min-h-dvh overflow-x-hidden text-white`}
        style={{
          backgroundColor: INK,
          backgroundImage:
            "radial-gradient(120% 55% at 50% -12%, rgba(0,133,252,0.30), rgba(4,97,196,0.10) 45%, transparent 70%)",
        }}
      >
        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 pt-[max(20px,env(safe-area-inset-top))]">
          <header className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Image src="/logo.png" alt="PadeLibre" width={32} height={32} className="rounded-lg" />
              <span className="text-[13px] font-medium tabular-nums text-white/55">Paso {step} de 5</span>
            </div>
            <Progress step={step} />
          </header>

          <div className="relative flex-1 pt-7">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-4"
              >
                <div className="mb-1">
                  <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-white">
                    {STEPS[step].title}
                  </h1>
                  <p className="mt-2 max-w-[34ch] text-[15px] leading-snug text-white/55">{STEPS[step].subtitle}</p>
                </div>

                {step === 1 && (
                  <>
                    <Panel className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        aria-label={avatarPreview ? "Cambiar foto de perfil" : "Agregar foto de perfil"}
                        className={`relative shrink-0 rounded-full ${focusRing}`}
                      >
                        <AvatarCircle src={avatarPreview} size={84} ring={avatarPreview ? LIME : "rgba(255,255,255,0.18)"} />
                        {uploadingAvatar ? (
                          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55">
                            <Loader2 size={22} className="animate-spin text-white" />
                          </span>
                        ) : null}
                        <span
                          className="absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-full border-[3px]"
                          style={{ backgroundColor: LIME, borderColor: INK }}
                        >
                          <Camera size={15} color={INK} strokeWidth={2.4} />
                        </span>
                      </button>
                      <div className="min-w-0">
                        <p className="text-[16px] font-semibold text-white">
                          {uploadingAvatar ? "Subiendo foto…" : avatarPreview ? "Buena foto" : "Agregá una foto"}
                        </p>
                        <p className="mt-1 text-[13px] leading-snug text-white/50">
                          {avatarPreview
                            ? "Tocala para cambiarla."
                            : "Así te reconocen en los partidos. Podés sumarla después."}
                        </p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (!file) return;
                          await handleAvatarUpload(file);
                        }}
                      />
                    </Panel>

                    <Panel className="flex flex-col gap-5">
                      <div>
                        <PanelLabel htmlFor="cp-name">Nombre y apellido</PanelLabel>
                        <input
                          id="cp-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Juan Pérez"
                          autoComplete="name"
                          autoCapitalize="words"
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <PanelLabel htmlFor="cp-birth">Fecha de nacimiento</PanelLabel>
                        <div className="relative">
                          <input
                            id="cp-birth"
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                            max={new Date().toISOString().slice(0, 10)}
                            autoComplete="bday"
                            style={{ colorScheme: "dark" }}
                            className={fieldClass}
                          />
                        </div>
                        <AnimatePresence>
                          {edad !== null ? (
                            <motion.p
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden text-[14px] text-white/60"
                            >
                              <span className="block pt-2.5">
                                Tenés <span className="font-bold text-[#CCFF00]">{edad} años</span>
                              </span>
                            </motion.p>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    </Panel>
                  </>
                )}

                {step === 2 && (
                  <>
                    <Panel>
                      <PanelLabel id="lbl-hand">Mano hábil</PanelLabel>
                      <div role="radiogroup" aria-labelledby="lbl-hand" className="grid grid-cols-2 gap-3">
                        {HAND_OPTIONS.map((opt) => (
                          <OptionTile
                            key={opt.id}
                            selected={preferredHand === opt.id}
                            onClick={() => setPreferredHand(opt.id)}
                            className="gap-1.5 px-3 py-4"
                          >
                            <RacketGlyph mirror={opt.mirror} active={preferredHand === opt.id} />
                            <span className="text-[16px] font-bold">{opt.label}</span>
                            <span className="text-[12px] text-white/45">{opt.sub}</span>
                          </OptionTile>
                        ))}
                      </div>
                    </Panel>

                    <Panel>
                      <PanelLabel id="lbl-pos">Posición en cancha</PanelLabel>
                      <div role="radiogroup" aria-labelledby="lbl-pos" className="grid grid-cols-3 gap-2.5">
                        {POSITION_OPTIONS.map((opt) => (
                          <OptionTile
                            key={opt.id}
                            selected={courtPosition === opt.id}
                            onClick={() => setCourtPosition(opt.id)}
                            className="gap-1.5 px-1.5 pb-3 pt-3.5"
                          >
                            <CourtGlyph side={opt.id} active={courtPosition === opt.id} />
                            <span className="text-[clamp(13px,3.9vw,15px)] font-bold">{opt.label}</span>
                            <span className="text-[11px] leading-tight text-white/45">{opt.sub}</span>
                          </OptionTile>
                        ))}
                      </div>
                    </Panel>

                    <Panel>
                      <PanelLabel id="lbl-sched">Horario favorito</PanelLabel>
                      <div role="radiogroup" aria-labelledby="lbl-sched" className="grid grid-cols-2 gap-2.5">
                        {SCHEDULE_OPTIONS.map(({ id, label, Icon }) => (
                          <OptionTile
                            key={id}
                            selected={preferredSchedule === id}
                            onClick={() => setPreferredSchedule(id)}
                            className="gap-1.5 px-2 py-3.5"
                          >
                            <Icon size={20} className={`shrink-0 ${preferredSchedule === id ? "text-[#CCFF00]" : "text-white/50"}`} />
                            <span className="text-[15px] font-semibold">{label}</span>
                          </OptionTile>
                        ))}
                      </div>
                    </Panel>
                  </>
                )}

                {step === 3 && (
                  <>
                    <Panel>
                      <PanelLabel id="lbl-gender">¿En qué rama jugás?</PanelLabel>
                      <div role="radiogroup" aria-labelledby="lbl-gender" className="grid grid-cols-2 gap-3">
                        {GENDER_OPTIONS.map(({ id, label, sub, Icon }) => (
                          <OptionTile
                            key={id}
                            selected={gender === id}
                            onClick={() => setGender(id)}
                            className="gap-1.5 px-3 py-5"
                          >
                            <Icon size={26} className={gender === id ? "text-[#CCFF00]" : "text-white/50"} />
                            <span className="text-[16px] font-bold">{label}</span>
                            <span className="text-[12px] text-white/45">{sub}</span>
                          </OptionTile>
                        ))}
                      </div>
                    </Panel>

                    <Panel>
                      <PanelLabel id="lbl-cat">Categoría</PanelLabel>
                      <div role="radiogroup" aria-labelledby="lbl-cat" className="grid grid-cols-4 gap-2">
                        {CATEGORIES.map((opt) => {
                          const selected = category === opt.value;
                          return (
                            <motion.button
                              key={opt.value}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setCategory(opt.value)}
                              whileTap={{ scale: 0.95 }}
                              className={`h-12 rounded-xl border text-[15px] font-bold transition-colors duration-150 ${focusRing} ${
                                selected
                                  ? "border-[#CCFF00] bg-[#CCFF00] text-[#06101E]"
                                  : "border-white/[0.10] bg-white/[0.03] text-white/70 hover:border-white/[0.22]"
                              }`}
                            >
                              {opt.value}
                            </motion.button>
                          );
                        })}
                      </div>
                      <div className="mt-4 flex min-h-[64px] items-center gap-4 rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3">
                        <LevelMeter level={categoryLevel} />
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={category || "empty"}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="min-w-0"
                          >
                            {categoryIndex >= 0 ? (
                              <>
                                <p className="text-[15px] font-bold text-white">{category} categoría</p>
                                <p className="text-[13px] leading-snug text-white/55">
                                  {CATEGORIES[categoryIndex].description}
                                </p>
                              </>
                            ) : (
                              <p className="text-[13px] leading-snug text-white/45">
                                De 8va (inicial) a 1ra (élite). Tocá una para ver qué significa.
                              </p>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                      <p className="mt-3 flex gap-2 text-[13px] leading-snug text-white/50">
                        <CircleAlert size={15} className="mt-0.5 shrink-0 text-[#CCFF00]/80" />
                        Elegí con honestidad: si no es tu categoría, no vas a poder sumarte a los partidos de tus amigos.
                      </p>
                    </Panel>
                  </>
                )}

                {step === 4 && (
                  <>
                    <Panel className={phoneView === "review" ? "relative overflow-hidden" : undefined}>
                      <AnimatePresence mode="wait" initial={false}>
                        {phoneView === "confirmed" ? (
                          <motion.div
                            key="confirmed"
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-start gap-3"
                          >
                            <motion.span
                              initial={{ scale: 0.5 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 380, damping: 20 }}
                              className="flex size-10 shrink-0 items-center justify-center rounded-full border-2"
                              style={{ borderColor: LIME }}
                            >
                              <Check size={19} color={LIME} strokeWidth={2.6} />
                            </motion.span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-bold leading-tight text-white" role="status">
                                Número confirmado por vos
                              </p>
                              <p className={`${ibmPlexMono.className} mt-1 whitespace-nowrap text-[14px] text-white/70`}>
                                {confirmedPhone ? formatArMobile(confirmedPhone) : ""}
                              </p>
                              <button
                                type="button"
                                onClick={editPhone}
                                className={`-ml-1 mt-1 flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 text-[14px] font-semibold text-[#5CB4FF] hover:text-[#8ccbff] ${focusRing}`}
                              >
                                <Pencil size={14} /> Cambiar número
                              </button>
                            </div>
                          </motion.div>
                        ) : phoneView === "review" && normalizedPhone ? (
                          <motion.div
                            key="review"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            className="flex flex-col"
                          >
                            <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: LIME }} />
                            <p className="text-[19px] font-bold leading-tight text-white" id="cp-phone-review">
                              ¿Este es tu número correcto?
                            </p>
                            <div
                              className="mt-4 rounded-2xl border border-white/[0.10] px-4 py-4"
                              style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                            >
                              <p
                                className={`${ibmPlexMono.className} whitespace-nowrap text-[clamp(17px,5.6vw,24px)] leading-none tracking-[0.01em] text-white`}
                                aria-describedby="cp-phone-review"
                              >
                                {formatArMobile(normalizedPhone)}
                              </p>
                              <p className="mt-2 text-[13px] text-white/45">Celular de Argentina</p>
                            </div>
                            <p className="mt-3.5 text-[14px] leading-snug text-white/60">
                              Si lo ingresás mal, el club podría no poder avisarte ante cualquier inconveniente con tu turno.
                            </p>
                            <div className="mt-5 flex flex-col gap-2">
                              <motion.button
                                type="button"
                                onClick={confirmPhone}
                                whileTap={{ scale: 0.98 }}
                                className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl text-[16px] font-bold ${focusRing}`}
                                style={{ backgroundColor: LIME, color: INK }}
                              >
                                <Check size={18} strokeWidth={2.6} /> Sí, es mi número
                              </motion.button>
                              <button
                                type="button"
                                onClick={editPhone}
                                className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/[0.12] text-[15px] font-semibold text-white/80 hover:bg-white/[0.05] hover:text-white ${focusRing}`}
                              >
                                <Pencil size={15} /> Corregir número
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="input"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col gap-3"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className="flex size-9 items-center justify-center rounded-full"
                                style={{ backgroundColor: "rgba(0,133,252,0.16)" }}
                              >
                                <Phone size={17} className="text-[#5CB4FF]" />
                              </span>
                              <label htmlFor="cp-phone" className="text-[17px] font-bold text-white">
                                Tu número de teléfono
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <span
                                className={`${ibmPlexMono.className} flex h-14 shrink-0 items-center rounded-2xl border border-white/[0.10] bg-white/[0.05] px-3.5 text-[16px] text-white/70`}
                              >
                                +54
                              </span>
                              <input
                                id="cp-phone"
                                ref={phoneInputRef}
                                value={phoneInput}
                                onChange={(e) => setPhoneInput(e.target.value.replace(/[^\d\s()+-]/g, ""))}
                                onBlur={() => setPhoneTouched(true)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    reviewPhone();
                                  }
                                }}
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel-national"
                                placeholder="11 2233 4455"
                                aria-describedby="cp-phone-help"
                                aria-invalid={Boolean(phoneProblem) || undefined}
                                className={`${fieldClass} ${ibmPlexMono.className} min-w-0 flex-1 tracking-wide`}
                              />
                            </div>
                            <p
                              id="cp-phone-help"
                              role={phoneProblem ? "alert" : undefined}
                              className={`text-[13px] leading-snug ${phoneProblem ? "text-[#FFB3B3]" : "text-white/50"}`}
                            >
                              {normalizedPhone ? (
                                <>
                                  Se va a guardar como{" "}
                                  <span className={`${ibmPlexMono.className} text-white/85`}>
                                    {formatArMobile(normalizedPhone)}
                                  </span>
                                </>
                              ) : phoneProblem ? (
                                phoneProblem
                              ) : (
                                "Con código de área, sin el 0 ni el 15. Tiene que ser tu celular real."
                              )}
                            </p>
                            <button
                              type="button"
                              onClick={reviewPhone}
                              disabled={!normalizedPhone}
                              className={`flex h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white transition-opacity disabled:opacity-40 ${focusRing}`}
                              style={{ background: `linear-gradient(180deg, ${BLUE}, ${BLUE_DEEP})` }}
                            >
                              Confirmar número
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Panel>

                    <Panel className="flex flex-col gap-4">
                      <div>
                        <PanelLabel htmlFor="cp-province">Provincia</PanelLabel>
                        <select
                          id="cp-province"
                          value={province}
                          onChange={(e) => {
                            setProvince(e.target.value);
                            setCity("");
                          }}
                          className={`${fieldClass} appearance-none`}
                          style={{ backgroundImage: SELECT_CHEVRON, backgroundRepeat: "no-repeat", backgroundPosition: "right 16px center" }}
                        >
                          <option value="" disabled style={{ backgroundColor: INK }}>
                            Seleccioná tu provincia
                          </option>
                          {ARGENTINA_PROVINCES.map((prov) => (
                            <option key={prov.code} value={prov.name} style={{ backgroundColor: INK }}>
                              {prov.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <AnimatePresence initial={false}>
                        {province ? (
                          <motion.div
                            key="city-field"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <PanelLabel htmlFor="cp-city">Ciudad</PanelLabel>
                            <select
                              id="cp-city"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              className={`${fieldClass} appearance-none`}
                              style={{ backgroundImage: SELECT_CHEVRON, backgroundRepeat: "no-repeat", backgroundPosition: "right 16px center" }}
                            >
                              <option value="" disabled style={{ backgroundColor: INK }}>
                                Seleccioná tu ciudad
                              </option>
                              {cities.map((cityName) => (
                                <option key={cityName} value={cityName} style={{ backgroundColor: INK }}>
                                  {cityName}
                                </option>
                              ))}
                            </select>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </Panel>

                    <p className="px-1 text-[12px] leading-snug text-white/40">
                      Tu número nunca se muestra públicamente. Solo lo ven los clubes donde reservás.
                    </p>
                  </>
                )}

                {step === 5 && (
                  <motion.section
                    initial={{ opacity: 0, y: 18, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden rounded-[28px] border border-white/[0.10]"
                    style={{ boxShadow: "0 24px 60px -20px rgba(0,133,252,0.45)" }}
                    aria-label="Resumen de tu perfil"
                  >
                    <div
                      className="relative px-5 pb-5 pt-6"
                      style={{ background: `linear-gradient(160deg, ${BLUE} 0%, ${BLUE_DEEP} 55%, #031733 100%)` }}
                    >
                      <svg
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        viewBox="0 0 400 200"
                        preserveAspectRatio="none"
                        aria-hidden
                      >
                        <g stroke="white" strokeOpacity=".12" strokeWidth="1.5" fill="none">
                          <rect x="210" y="-10" width="220" height="230" />
                          <line x1="210" y1="120" x2="430" y2="120" />
                          <line x1="320" y1="-10" x2="320" y2="120" />
                        </g>
                      </svg>
                      <div className="relative flex items-center gap-4">
                        <AvatarCircle src={avatarPreview} size={76} ring="rgba(255,255,255,0.85)" />
                        <div className="min-w-0">
                          <p className="truncate text-[24px] font-bold leading-tight text-white">{name}</p>
                          {edad ? <p className="text-[14px] text-white/75">{edad} años</p> : null}
                        </div>
                      </div>
                      <div className="relative mt-5 flex items-end justify-between">
                        <div>
                          <p className="text-[12px] font-medium text-white/70">Categoría</p>
                          <p className="text-[40px] font-bold leading-none tracking-[-0.03em] text-[#CCFF00]">
                            {category}
                          </p>
                        </div>
                        <LevelMeter level={categoryLevel} />
                      </div>
                    </div>

                    <div className="bg-[#0A1A30] px-2 py-2">
                      {summaryRows
                        .filter((r) => r.value)
                        .map((row) => (
                          <button
                            key={row.label}
                            type="button"
                            onClick={() => goTo(row.step)}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/[0.04] ${focusRing}`}
                          >
                            <span className="text-[14px] text-white/50">{row.label}</span>
                            <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-white">
                              <span className="truncate">{row.value}</span>
                              <Pencil size={13} className="shrink-0 text-white/30" />
                            </span>
                          </button>
                        ))}
                    </div>
                  </motion.section>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div
            className="sticky bottom-0 z-20 -mx-5 mt-6 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-5"
            style={{ background: `linear-gradient(to top, ${INK} 72%, rgba(6,16,30,0))` }}
          >
            <AnimatePresence>
              {!canContinue && blockedHint ? (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-2.5 text-center text-[13px] text-white/45"
                >
                  {blockedHint}
                </motion.p>
              ) : null}
            </AnimatePresence>
            <div className="flex gap-3">
              {step > 1 ? (
                <motion.button
                  type="button"
                  onClick={goBack}
                  disabled={pending}
                  aria-label="Volver al paso anterior"
                  whileTap={{ scale: 0.94 }}
                  className={`flex size-14 shrink-0 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.05] text-white hover:bg-white/[0.09] disabled:opacity-40 ${focusRing}`}
                >
                  <ArrowLeft size={20} />
                </motion.button>
              ) : null}
              {step < 5 ? (
                <PrimaryButton enabled={canContinue} onClick={goNext}>
                  Continuar
                </PrimaryButton>
              ) : (
                <PrimaryButton enabled={!pending} pending={pending} onClick={handleFinish}>
                  Empezar a jugar
                </PrimaryButton>
              )}
            </div>
          </div>
        </div>
        <AppleToast message={toast} />
      </main>
    </MotionConfig>
  );
}

const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.55)' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";
