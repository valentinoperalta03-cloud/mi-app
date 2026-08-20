"use client";

import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import Image from "next/image";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppleToast } from "@/components/apple-toast";
import { ARGENTINA_PROVINCES } from "@/lib/argentina-provinces";
import { createClient } from "@/utils/supabase/client";
import { completarPerfilAction } from "./actions";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const LIME = "#CCFF00";
const BG = "#06101E";

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
  { id: "drive" as const, label: "Drive" },
  { id: "reves" as const, label: "Revés" },
  { id: "ambas" as const, label: "Indistinto" },
];

const GENDER_OPTIONS = [
  { id: "masculino" as const, label: "Caballeros", emoji: "👨" },
  { id: "femenino" as const, label: "Damas", emoji: "👩" },
];

const SCHEDULE_OPTIONS = [
  { id: "manana" as const, label: "🌅 Mañana" },
  { id: "tarde" as const, label: "☀️ Tarde" },
  { id: "noche" as const, label: "🌙 Noche" },
  { id: "cualquiera" as const, label: "🕐 Cualquiera" },
];

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

const stepTransition = { type: "spring" as const, stiffness: 280, damping: 28 };

const slideVariants = {
  enter: { x: 40, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -40, opacity: 0 },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const cardShadow = "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.3)";

function Kicker({ step }: { step: Step }) {
  return (
    <span className={`${ibmPlexMono.className} text-[10px] uppercase tracking-[0.2em] text-[#CCFF00]/60`}>
      Paso {step} / 5
    </span>
  );
}

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="flex w-full gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.div
          key={i}
          className="h-1 flex-1 rounded-full"
          animate={{
            backgroundColor: i <= step ? LIME : "rgba(255,255,255,0.10)",
            boxShadow: i === step ? "0 0 8px rgba(204,255,0,0.6)" : "none",
          }}
          transition={{ duration: 0.3 }}
        />
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className={`${spaceGrotesk.className} text-[28px] font-black uppercase leading-tight text-white`}>
      {children}
    </h1>
  );
}

function Card({ children, index = 0 }: { children: React.ReactNode; index?: number }) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.08, duration: 0.35, ease: "easeOut" }}
      style={{ boxShadow: cardShadow }}
      className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-md"
    >
      {children}
    </motion.div>
  );
}

function HighlightCard({ children, index = 0 }: { children: React.ReactNode; index?: number }) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.08, duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.05] p-4"
    >
      {children}
    </motion.div>
  );
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, style, ...rest } = props;
  return (
    <select
      {...rest}
      style={{ height: 52, ...style }}
      className={`w-full rounded-2xl border border-white/[0.10] bg-white/[0.06] px-4 text-[15px] text-white outline-none transition-colors focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/20 disabled:opacity-40 ${className ?? ""}`}
    />
  );
}

function HandCard({
  selected,
  onClick,
  label,
  sub,
  mirror,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  mirror: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      animate={{
        borderColor: selected ? "#CCFF00" : "rgba(255,255,255,0.10)",
        backgroundColor: selected ? "rgba(204,255,0,0.08)" : "rgba(255,255,255,0.04)",
        boxShadow: selected ? "0 0 20px rgba(204,255,0,0.2)" : "none",
      }}
      className="flex flex-1 flex-col items-center gap-3 rounded-3xl border p-6"
    >
      <motion.span
        animate={selected ? { rotate: [0, -15, 15, 0] } : { rotate: 0 }}
        transition={{ duration: 0.5 }}
        style={{ display: "inline-block", transform: mirror ? "scaleX(-1)" : undefined }}
        className="text-[48px]"
      >
        🤚
      </motion.span>
      <span className={`text-base font-black ${selected ? "text-[#CCFF00]" : "text-white"}`}>{label}</span>
      <span className="text-xs text-white/40">{sub}</span>
    </motion.button>
  );
}

function PositionChip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.95 }}
      animate={{
        borderColor: selected ? "#CCFF00" : "rgba(255,255,255,0.10)",
        backgroundColor: selected ? "rgba(204,255,0,0.08)" : "rgba(255,255,255,0.05)",
        boxShadow: selected ? "0 0 20px rgba(204,255,0,0.2)" : "none",
      }}
      style={{ height: 64 }}
      className="flex flex-1 flex-col items-center justify-center rounded-2xl border"
    >
      <span className={`text-sm font-bold ${selected ? "text-[#CCFF00]" : "text-white"}`}>{label}</span>
    </motion.button>
  );
}

function ScheduleChip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      animate={{
        borderColor: selected ? "#CCFF00" : "rgba(255,255,255,0.10)",
        backgroundColor: selected ? "rgba(204,255,0,0.08)" : "rgba(255,255,255,0.04)",
        boxShadow: selected ? "0 0 15px rgba(204,255,0,0.2)" : "none",
      }}
      className="rounded-2xl border py-3 text-sm font-semibold text-white"
    >
      {label}
    </motion.button>
  );
}

function GenderCard({
  selected,
  onClick,
  emoji,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      animate={{
        borderColor: selected ? "#CCFF00" : "rgba(255,255,255,0.10)",
        backgroundColor: selected ? "rgba(204,255,0,0.08)" : "rgba(255,255,255,0.04)",
      }}
      style={{ minHeight: 120 }}
      className="flex flex-1 flex-col items-center gap-3 rounded-3xl border p-6"
    >
      <span className="text-[56px]">{emoji}</span>
      <span className={`text-base font-black ${selected ? "text-[#CCFF00]" : "text-white"}`}>{label}</span>
    </motion.button>
  );
}

function CategoryChip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      animate={{
        boxShadow: selected ? "0 0 20px rgba(204,255,0,0.25)" : "none",
      }}
      className={`rounded-xl py-3 text-sm font-black transition-colors duration-150 ${
        selected
          ? "border border-transparent bg-[#CCFF00] text-[#06101E]"
          : "border border-white/[0.10] bg-white/[0.05] text-white/60 hover:border-white/[0.20] hover:bg-white/[0.08]"
      }`}
    >
      {label}
    </motion.button>
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
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!enabled || pending}
      whileHover={enabled ? { scale: 1.02, boxShadow: "0 0 40px rgba(204,255,0,0.5)" } : {}}
      whileTap={enabled ? { scale: 0.97 } : {}}
      style={{ boxShadow: enabled ? "0 0 25px rgba(204,255,0,0.3)" : "none" }}
      className={`w-full rounded-2xl bg-[#CCFF00] py-4 text-base font-black uppercase tracking-widest text-[#06101E] disabled:cursor-not-allowed disabled:opacity-30 ${spaceGrotesk.className}`}
    >
      {pending ? <Loader2 size={18} className="mx-auto animate-spin" /> : children}
    </motion.button>
  );
}

function FinalButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={pending}
      animate={{
        boxShadow: [
          "0 0 20px rgba(204,255,0,0.3)",
          "0 0 40px rgba(204,255,0,0.5)",
          "0 0 20px rgba(204,255,0,0.3)",
        ],
      }}
      transition={{ repeat: Infinity, duration: 2.5 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={`w-full rounded-2xl bg-[#CCFF00] py-4 text-base font-black uppercase tracking-widest text-[#06101E] disabled:cursor-not-allowed disabled:opacity-30 ${spaceGrotesk.className}`}
    >
      {pending ? <Loader2 className="mx-auto animate-spin" size={20} /> : "¡A jugar! →"}
    </motion.button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Volver"
      whileTap={{ scale: 0.94 }}
      className="fixed bottom-6 left-6 z-20 rounded-full border border-white/[0.10] bg-white/[0.08] p-3 transition-colors hover:bg-white/[0.12]"
    >
      <ChevronLeft size={18} className="text-white" />
    </motion.button>
  );
}

function AvatarCircle({
  avatarPreview,
  onClick,
  size,
  pulseInfinite,
}: {
  avatarPreview: string | null;
  onClick?: () => void;
  size: number;
  pulseInfinite?: boolean;
}) {
  return (
    <motion.div
      whileHover={onClick ? { scale: 1.05 } : {}}
      whileTap={onClick ? { scale: 0.95 } : {}}
      onClick={onClick}
      animate={
        pulseInfinite
          ? {
              boxShadow: [
                "0 0 20px rgba(204,255,0,0.3)",
                "0 0 40px rgba(204,255,0,0.6)",
                "0 0 20px rgba(204,255,0,0.3)",
              ],
            }
          : {}
      }
      transition={pulseInfinite ? { repeat: Infinity, duration: 2 } : { duration: 0.2 }}
      className={`relative mx-auto overflow-hidden rounded-full ${onClick ? "cursor-pointer" : ""}`}
      style={{
        width: size,
        height: size,
        border: pulseInfinite ? "2px solid #CCFF00" : "2px solid rgba(204,255,0,0.5)",
        boxShadow: pulseInfinite ? undefined : "0 0 20px rgba(204,255,0,0.2), inset 0 0 20px rgba(204,255,0,0.05)",
      }}
    >
      {avatarPreview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/[0.06]">
          <span className="text-5xl">🧑</span>
        </div>
      )}
      {onClick ? (
        <div
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-full bg-[#CCFF00]"
          style={{ width: 28, height: 28 }}
        >
          <span style={{ fontSize: 14 }}>📷</span>
        </div>
      ) : null}
    </motion.div>
  );
}

export default function CompletarPerfilClient({
  next,
  googleAvatarUrl,
}: {
  next?: string;
  googleAvatarUrl?: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(1);

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

  // Paso 4 — Contacto
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");

  const edad = calcularEdad(birthDate);

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

  const canStep1 = Boolean(name.trim() && birthDate && edad !== null);
  const canStep2 = Boolean(preferredHand && courtPosition && preferredSchedule);
  const canStep3 = Boolean(gender && category);
  const canStep4 = Boolean(phone.replace(/\D/g, "").length >= 8 && province);

  function goNext() {
    if (step === 1 && !canStep1) return;
    if (step === 2 && !canStep2) return;
    if (step === 3 && !canStep3) return;
    if (step === 4 && !canStep4) return;
    setStep((s) => (s < 5 ? ((s + 1) as Step) : s));
  }

  function goBack() {
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  function handleFinish() {
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
        phone: `+54${phone.replace(/\D/g, "")}`,
        province,
        city: city.trim(),
        next: next || null,
      });
      if (res && !res.ok) {
        showToast(res.message);
      }
    });
  }

  const categoryDescription = CATEGORIES.find((c) => c.value === category)?.description;
  const genderPill = gender === "masculino" ? "👨 Caballeros" : gender === "femenino" ? "👩 Damas" : "";
  const handPill = preferredHand === "derecha" ? "🏏 Diestro" : preferredHand === "izquierda" ? "🤜 Zurdo" : "";
  const positionPill =
    courtPosition === "drive" ? "🎯 Drive" : courtPosition === "reves" ? "🔄 Revés" : courtPosition === "ambas" ? "↔️ Indistinto" : "";
  const summaryPills = [genderPill, handPill, positionPill, province].filter(Boolean);

  return (
    <main
      className="relative min-h-dvh overflow-hidden"
      style={{
        background: BG,
        backgroundImage: "radial-gradient(rgba(204,255,0,0.05) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    >
      <div className="fixed inset-x-0 top-0 z-30 h-[2px]" style={{ backgroundColor: LIME }} />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-8 px-5 py-6">
        <div className="flex flex-col items-center gap-5">
          <Image src="/logo.png" alt="PadeLibre" width={32} height={32} className="rounded-lg" />
          <div className="flex w-full flex-col items-center gap-2">
            <Kicker step={step} />
            <ProgressBar step={step} />
          </div>
        </div>

        <div className="relative flex-1 overflow-visible pb-16">
          <AnimatePresence mode="wait" initial={false}>
            {step === 1 && (
              <motion.div
                key="step1"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={stepTransition}
                className="flex flex-col gap-5"
              >
                <SectionTitle>Datos personales</SectionTitle>

                <Card index={0}>
                  <div className="flex flex-col items-center gap-3">
                    <AvatarCircle
                      avatarPreview={avatarPreview}
                      onClick={() => fileInputRef.current?.click()}
                      size={96}
                    />
                    <p className="text-xs text-white/40">
                      {uploadingAvatar ? "Subiendo foto…" : "Tocá para agregar tu foto"}
                    </p>
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
                  </div>
                </Card>

                <Card index={1}>
                  <div className="flex flex-col gap-5">
                    <div className="space-y-1.5">
                      <label className={`${ibmPlexMono.className} text-[10px] uppercase tracking-[0.2em] text-white/40`}>
                        Tu nombre completo
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Juan Pérez"
                        style={{ height: 52 }}
                        className="w-full rounded-2xl border border-white/[0.10] bg-white/[0.06] px-4 text-white outline-none placeholder:text-white/25 focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={`${ibmPlexMono.className} block text-xs uppercase tracking-wider text-white/40`}>
                        Fecha de nacimiento
                      </label>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        max={new Date().toISOString().slice(0, 10)}
                        style={{ height: 52, colorScheme: "dark" }}
                        className="w-full rounded-2xl border border-white/[0.10] bg-white/[0.06] px-4 py-3 text-white outline-none focus:border-[#CCFF00]"
                      />
                      <AnimatePresence>
                        {edad !== null ? (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2"
                          >
                            <span className="text-lg font-black text-[#CCFF00]">{edad}</span>
                            <span className="text-sm text-white/50">años 🎂</span>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                </Card>

                <div className="px-1 pb-1">
                  <PrimaryButton enabled={canStep1} onClick={goNext}>
                    Continuar
                  </PrimaryButton>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={stepTransition}
                className="flex flex-col gap-5"
              >
                <SectionTitle>Estilo de juego</SectionTitle>

                <Card index={0}>
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-bold text-white/70">Mano hábil</span>
                    <div className="flex gap-3">
                      {HAND_OPTIONS.map((opt) => (
                        <HandCard
                          key={opt.id}
                          selected={preferredHand === opt.id}
                          onClick={() => setPreferredHand(opt.id)}
                          label={opt.label}
                          sub={opt.sub}
                          mirror={opt.mirror}
                        />
                      ))}
                    </div>
                  </div>
                </Card>

                <Card index={1}>
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-bold text-white/70">Posición en cancha</span>
                    <div className="flex gap-2">
                      {POSITION_OPTIONS.map((opt) => (
                        <PositionChip
                          key={opt.id}
                          selected={courtPosition === opt.id}
                          onClick={() => setCourtPosition(opt.id)}
                          label={opt.label}
                        />
                      ))}
                    </div>
                  </div>
                </Card>

                <Card index={2}>
                  <div className="space-y-3">
                    <label className={`${ibmPlexMono.className} text-[10px] uppercase tracking-[0.2em] text-white/40`}>
                      Horario favorito
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {SCHEDULE_OPTIONS.map((opt) => (
                        <ScheduleChip
                          key={opt.id}
                          selected={preferredSchedule === opt.id}
                          onClick={() => setPreferredSchedule(opt.id)}
                          label={opt.label}
                        />
                      ))}
                    </div>
                  </div>
                </Card>

                <div className="px-1 pb-1">
                  <PrimaryButton enabled={canStep2} onClick={goNext}>
                    Continuar
                  </PrimaryButton>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={stepTransition}
                className="flex flex-col gap-5"
              >
                <SectionTitle>Perfil deportivo</SectionTitle>

                <Card index={0}>
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-bold text-white/70">Género</span>
                    <div className="flex gap-3">
                      {GENDER_OPTIONS.map((opt) => (
                        <GenderCard
                          key={opt.id}
                          selected={gender === opt.id}
                          onClick={() => setGender(opt.id)}
                          emoji={opt.emoji}
                          label={opt.label}
                        />
                      ))}
                    </div>
                  </div>
                </Card>

                <HighlightCard index={1}>
                  <p className="text-sm font-bold text-white">🏆 Elegí con honestidad</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">
                    Si elegís una categoría que no es la tuya, no vas a poder unirte a partidos con tus amigos.
                    Mejor empezar bien 😊
                  </p>
                </HighlightCard>

                <Card index={2}>
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-bold text-white/70">Categoría</span>
                    <div className="grid grid-cols-4 gap-2">
                      {CATEGORIES.map((opt) => (
                        <CategoryChip
                          key={opt.value}
                          label={opt.value}
                          selected={category === opt.value}
                          onClick={() => setCategory(opt.value)}
                        />
                      ))}
                    </div>
                    <AnimatePresence>
                      {categoryDescription ? (
                        <motion.p
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className="text-xs text-white/50"
                        >
                          {categoryDescription}
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </Card>

                <div className="px-1 pb-1">
                  <PrimaryButton enabled={canStep3} onClick={goNext}>
                    Continuar
                  </PrimaryButton>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={stepTransition}
                className="flex flex-col gap-5"
              >
                <SectionTitle>Contacto</SectionTitle>

                <motion.div
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="flex items-start gap-3 rounded-2xl border border-[#25D366]/30 p-4"
                  style={{ background: "rgba(37,211,102,0.05)" }}
                >
                  <span className="shrink-0 text-2xl">💬</span>
                  <div>
                    <p className="text-sm font-bold text-white">Tu WhatsApp es clave</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/55">
                      Es tu principal medio de comunicación con los clubes donde reservés. Te van a escribir para
                      confirmar turnos y novedades. Tu número nunca se comparte públicamente.
                    </p>
                  </div>
                </motion.div>

                <Card index={1}>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/[0.10] bg-white/[0.06] px-3"
                      style={{ height: 52 }}
                    >
                      <span className="text-lg">💬</span>
                      <span className={`${ibmPlexMono.className} text-sm text-white/70`}>+54</span>
                    </div>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                      inputMode="numeric"
                      placeholder="91122334455"
                      style={{ height: 52 }}
                      className="flex-1 rounded-2xl border border-white/[0.10] bg-white/[0.06] px-4 text-white placeholder:text-white/25 outline-none focus:border-[#CCFF00]"
                    />
                  </div>
                </Card>

                <Card index={2}>
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-bold text-white/70">Provincia</span>
                    <SelectField
                      value={province}
                      onChange={(e) => {
                        setProvince(e.target.value);
                        setCity("");
                      }}
                    >
                      <option value="" disabled style={{ backgroundColor: BG }} className="text-white/35">
                        Seleccioná tu provincia
                      </option>
                      {ARGENTINA_PROVINCES.map((prov) => (
                        <option key={prov.code} value={prov.name} style={{ backgroundColor: BG }} className="text-white">
                          {prov.name}
                        </option>
                      ))}
                    </SelectField>

                    <AnimatePresence>
                      {province ? (
                        <motion.div
                          key="city-field"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 200, damping: 25 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-3 pt-3">
                            <span className="text-sm font-bold text-white/70">Ciudad</span>
                            <SelectField value={city} onChange={(e) => setCity(e.target.value)}>
                              <option value="" disabled style={{ backgroundColor: BG }} className="text-white/35">
                                Seleccioná tu ciudad
                              </option>
                              {(ARGENTINA_PROVINCES.find((prov) => prov.name === province)?.cities ?? []).map(
                                (cityName) => (
                                  <option
                                    key={cityName}
                                    value={cityName}
                                    style={{ backgroundColor: BG }}
                                    className="text-white"
                                  >
                                    {cityName}
                                  </option>
                                )
                              )}
                            </SelectField>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </Card>

                <div className="px-1 pb-1">
                  <PrimaryButton enabled={canStep4} onClick={goNext}>
                    Continuar
                  </PrimaryButton>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={stepTransition}
                className="flex flex-col gap-5"
              >
                <SectionTitle>Confirmación</SectionTitle>

                <motion.div
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="rounded-3xl border border-white/[0.10] p-6 text-center"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    backdropFilter: "blur(20px)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4)",
                  }}
                >
                  <AvatarCircle avatarPreview={avatarPreview} size={96} pulseInfinite />

                  <p className="mt-4 text-[22px] font-black text-white">{name}</p>
                  {edad ? <p className="text-sm text-white/40">{edad} años</p> : null}

                  {category ? (
                    <span className="mt-3 inline-block rounded-full bg-[#CCFF00] px-4 py-1.5 text-sm font-black text-[#06101E]">
                      {category}
                    </span>
                  ) : null}

                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {summaryPills.map((pill) => (
                      <span
                        key={pill}
                        className="rounded-full border border-white/[0.10] bg-white/[0.08] px-3 py-1 text-xs text-white/70"
                      >
                        {pill}
                      </span>
                    ))}
                  </div>
                </motion.div>

                <div className="px-1 pb-1">
                  <FinalButton pending={pending} onClick={handleFinish} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step > 1 ? <BackButton onClick={goBack} /> : null}
      </div>
      <AppleToast message={toast} />
    </main>
  );
}
