"use client";

import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import Image from "next/image";
import { Camera, ChevronLeft, Loader2, User } from "lucide-react";
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
const DARK = "#030812";
const NAVY = "#0A1628";

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

const springTransition = { type: "spring" as const, stiffness: 300, damping: 30 };

const slideVariants = {
  enter: { x: 40, opacity: 0 },
  center: { x: 0, opacity: 1, transition: { ...springTransition, staggerChildren: 0.08 } },
  exit: { x: -40, opacity: 0 },
};

const itemVariants = {
  enter: { opacity: 0, y: 16 },
  center: { opacity: 1, y: 0 },
};

function Kicker({ step }: { step: Step }) {
  return (
    <span className={`${ibmPlexMono.className} text-[11px] uppercase tracking-[0.2em] text-[#CCFF00]/60`}>
      Paso {step} / 5
    </span>
  );
}

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="flex w-full gap-2">
      {[1, 2, 3, 4, 5].map((s) => (
        <motion.div
          key={s}
          className="h-[4px] flex-1 rounded-full"
          initial={false}
          animate={{
            backgroundColor: s <= step ? LIME : "rgba(255,255,255,0.10)",
            boxShadow: s <= step ? "0 0 8px rgba(204,255,0,0.55)" : "0 0 0px rgba(204,255,0,0)",
          }}
          transition={springTransition}
        />
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className={`${spaceGrotesk.className} text-[26px] font-black uppercase tracking-tight text-white`}>
      {children}
    </h1>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={itemVariants}
      className="rounded-3xl border border-white/[0.07] bg-white/[0.04] p-5 backdrop-blur-sm"
    >
      {children}
    </motion.div>
  );
}

function FloatingInput({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [focused, setFocused] = useState(false);
  const active = focused || Boolean(value);
  return (
    <div className="relative">
      <input
        {...rest}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ height: 56 }}
        className="w-full rounded-2xl border border-white/[0.10] bg-white/[0.05] px-4 pt-3 text-[15px] text-white outline-none transition-colors focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/20"
      />
      <motion.label
        initial={false}
        animate={{
          top: active ? 8 : 18,
          fontSize: active ? 11 : 15,
          color: active ? "rgba(204,255,0,0.75)" : "rgba(255,255,255,0.35)",
        }}
        transition={{ duration: 0.15 }}
        className="pointer-events-none absolute left-4 origin-left"
      >
        {label}
      </motion.label>
    </div>
  );
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, style, ...rest } = props;
  return (
    <select
      {...rest}
      style={{ height: 52, ...style }}
      className={`w-full rounded-2xl border border-white/[0.10] bg-white/[0.05] px-4 text-[15px] text-white outline-none transition-colors focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/20 disabled:opacity-40 ${className ?? ""}`}
    />
  );
}

function WiggleChip({
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
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      animate={{
        borderColor: selected ? "#CCFF00" : "rgba(255,255,255,0.10)",
        backgroundColor: selected ? "rgba(204,255,0,0.08)" : "rgba(255,255,255,0.05)",
      }}
      transition={{ duration: 0.2 }}
      className="flex flex-1 cursor-pointer flex-col items-center gap-3 rounded-2xl border p-5"
    >
      <motion.span
        animate={selected ? { rotate: [0, -10, 10, 0] } : { rotate: 0 }}
        transition={{ duration: 0.4 }}
        className="text-4xl"
      >
        {emoji}
      </motion.span>
      <span className="text-sm font-bold text-white">{label}</span>
    </motion.div>
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
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      animate={{
        scale: selected ? 1.02 : 1,
        borderColor: selected ? "#CCFF00" : "rgba(255,255,255,0.10)",
        backgroundColor: selected ? "rgba(204,255,0,0.08)" : "rgba(255,255,255,0.05)",
      }}
      transition={{ duration: 0.2 }}
      style={{ height: 88 }}
      className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border"
    >
      <span className="text-3xl">{emoji}</span>
      <span className="text-sm font-bold text-white">{label}</span>
    </motion.div>
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
      className={`rounded-xl py-3 text-sm font-bold transition-colors duration-150 ${
        selected
          ? "border-transparent bg-[#CCFF00] text-[#030812]"
          : "border border-white/[0.10] bg-white/[0.05] text-white/65 hover:bg-white/[0.10]"
      }`}
    >
      {label}
    </motion.button>
  );
}

function MainButton({
  enabled,
  pending,
  onClick,
  pulse,
  children,
}: {
  enabled: boolean;
  pending?: boolean;
  onClick: () => void;
  pulse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!enabled || pending}
      whileTap={enabled ? { scale: 0.98 } : {}}
      animate={pulse && enabled && !pending ? { scale: [1, 1.03, 1] } : { scale: 1 }}
      transition={pulse ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.15 }}
      style={{
        boxShadow: enabled ? "0 0 30px rgba(204,255,0,0.20)" : "none",
      }}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-[#CCFF00] py-4 text-base font-black uppercase tracking-wide text-[#030812] disabled:cursor-not-allowed disabled:opacity-40 ${spaceGrotesk.className}`}
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </motion.button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Volver"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white transition hover:bg-white/[0.14]"
    >
      <ChevronLeft size={18} />
    </button>
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
  const canStep2 = Boolean(preferredHand && courtPosition);
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
        preferredSchedule: "cualquiera",
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
  const handLabel = preferredHand === "derecha" ? "Diestro" : preferredHand === "izquierda" ? "Zurdo" : "";
  const positionLabel =
    courtPosition === "drive" ? "Drive" : courtPosition === "reves" ? "Revés" : "Indistinto";

  return (
    <main
      className="relative min-h-dvh overflow-hidden"
      style={{ background: "linear-gradient(135deg, #030812 0%, #0A1628 50%, #0D1F3C 100%)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(204,255,0,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-8 px-5 py-6">
        <div className="flex flex-col items-center gap-5">
          <Image src="/logo.png" alt="PadeLibre" width={32} height={32} className="rounded-lg" />
          <div className="flex w-full flex-col items-center gap-2">
            <Kicker step={step} />
            <ProgressBar step={step} />
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {step === 1 && (
              <motion.div
                key="step1"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={springTransition}
                className="flex flex-col gap-5"
              >
                <SectionTitle>Datos personales</SectionTitle>

                <Card>
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <motion.button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        animate={{
                          borderColor: [
                            "rgba(204,255,0,0.4)",
                            "rgba(204,255,0,0.85)",
                            "rgba(204,255,0,0.4)",
                          ],
                        }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                        className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 bg-white/[0.06]"
                      >
                        {avatarPreview ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                              <Camera size={20} className="text-white" />
                            </div>
                          </>
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center"
                            style={{ backgroundColor: "rgba(204,255,0,0.10)" }}
                          >
                            <User size={30} style={{ color: LIME }} />
                          </div>
                        )}
                      </motion.button>
                      <span
                        style={{ backgroundColor: LIME }}
                        className="pointer-events-none absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#030812]"
                      >
                        <Camera size={13} color={DARK} />
                      </span>
                    </div>
                    <p className="text-xs text-white/40">
                      {uploadingAvatar ? "Subiendo foto…" : "Tocá para cambiar tu foto"}
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

                <Card>
                  <div className="flex flex-col gap-4">
                    <FloatingInput label="Tu nombre completo" value={name} onChange={(e) => setName(e.target.value)} />
                    <div>
                      <span className="mb-2 block text-sm font-bold text-white/70">¿Cuándo naciste?</span>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        max={new Date().toISOString().slice(0, 10)}
                        style={{ height: 52 }}
                        className="w-full rounded-2xl border border-white/[0.10] bg-white/[0.05] px-4 text-[15px] text-white outline-none transition-colors focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/20"
                      />
                      <AnimatePresence>
                        {edad !== null && (
                          <motion.span
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="mt-2 inline-block rounded-full border border-[#CCFF00]/30 bg-[#CCFF00]/10 px-3 py-1 text-sm font-bold text-[#CCFF00]"
                          >
                            {edad} años 🎂
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </Card>

                <MainButton enabled={canStep1} onClick={goNext}>
                  Continuar
                </MainButton>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={springTransition}
                className="flex flex-col gap-5"
              >
                <SectionTitle>Estilo de juego</SectionTitle>

                <Card>
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-bold text-white/70">Mano hábil</span>
                    <div className="flex gap-3">
                      <WiggleChip
                        selected={preferredHand === "derecha"}
                        onClick={() => setPreferredHand("derecha")}
                        emoji="🖐️"
                        label="Diestro"
                      />
                      <WiggleChip
                        selected={preferredHand === "izquierda"}
                        onClick={() => setPreferredHand("izquierda")}
                        emoji="🤚"
                        label="Zurdo"
                      />
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-bold text-white/70">Posición en cancha</span>
                    <div className="flex gap-2">
                      <WiggleChip
                        selected={courtPosition === "drive"}
                        onClick={() => setCourtPosition("drive")}
                        emoji="🎯"
                        label="Drive"
                      />
                      <WiggleChip
                        selected={courtPosition === "reves"}
                        onClick={() => setCourtPosition("reves")}
                        emoji="🔄"
                        label="Revés"
                      />
                      <WiggleChip
                        selected={courtPosition === "ambas"}
                        onClick={() => setCourtPosition("ambas")}
                        emoji="↔️"
                        label="Indistinto"
                      />
                    </div>
                  </div>
                </Card>

                <MainButton enabled={canStep2} onClick={goNext}>
                  Continuar
                </MainButton>

                <div className="flex justify-start">
                  <BackButton onClick={goBack} />
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
                transition={springTransition}
                className="flex flex-col gap-5"
              >
                <SectionTitle>Perfil deportivo</SectionTitle>

                <Card>
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-bold text-white/70">Género</span>
                    <div className="flex gap-3">
                      <GenderCard
                        selected={gender === "masculino"}
                        onClick={() => setGender("masculino")}
                        emoji="♂️"
                        label="Caballeros"
                      />
                      <GenderCard
                        selected={gender === "femenino"}
                        onClick={() => setGender("femenino")}
                        emoji="♀️"
                        label="Damas"
                      />
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-bold text-white/70">Categoría</span>
                    <div className="rounded-2xl border border-[#CCFF00]/30 bg-[#CCFF00]/5 px-4 py-3 text-[13px] leading-relaxed text-white/80">
                      🏆 Elegí tu categoría con honestidad. Si mentís, no vas a poder unirte a partidos con tus
                      amigos.
                    </div>
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

                <MainButton enabled={canStep3} onClick={goNext}>
                  Continuar
                </MainButton>

                <div className="flex justify-start">
                  <BackButton onClick={goBack} />
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
                transition={springTransition}
                className="flex flex-col gap-5"
              >
                <SectionTitle>Contacto</SectionTitle>

                <motion.div variants={itemVariants} className="rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.04] p-4">
                  <p className="text-sm font-semibold text-white">📱 Tu WhatsApp es clave</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">
                    Es tu principal medio de comunicación con los clubes donde reservés. Te van a escribir para
                    confirmar turnos, novedades y más.
                  </p>
                </motion.div>

                <Card>
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-bold text-white/70">WhatsApp</span>
                    <div className="flex gap-2">
                      <span
                        style={{ height: 52 }}
                        className="flex items-center rounded-2xl border border-white/[0.10] bg-white/[0.05] px-3 text-[15px] font-medium text-white/70"
                      >
                        +54
                      </span>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                        inputMode="numeric"
                        placeholder="91122334455"
                        style={{ height: 52 }}
                        className="flex-1 rounded-2xl border border-white/[0.10] bg-white/[0.05] px-4 text-[15px] text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00]/20"
                      />
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-bold text-white/70">Provincia</span>
                    <SelectField
                      value={province}
                      onChange={(e) => {
                        setProvince(e.target.value);
                        setCity("");
                      }}
                    >
                      <option value="" disabled style={{ backgroundColor: NAVY }} className="text-white/35">
                        Seleccioná tu provincia
                      </option>
                      {ARGENTINA_PROVINCES.map((prov) => (
                        <option key={prov.code} value={prov.name} style={{ backgroundColor: NAVY }} className="text-white">
                          {prov.name}
                        </option>
                      ))}
                    </SelectField>

                    <AnimatePresence initial={false}>
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
                              <option value="" disabled style={{ backgroundColor: NAVY }} className="text-white/35">
                                Seleccioná tu ciudad
                              </option>
                              {(ARGENTINA_PROVINCES.find((prov) => prov.name === province)?.cities ?? []).map(
                                (cityName) => (
                                  <option
                                    key={cityName}
                                    value={cityName}
                                    style={{ backgroundColor: NAVY }}
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

                <MainButton enabled={canStep4} onClick={goNext}>
                  Continuar
                </MainButton>

                <div className="flex justify-start">
                  <BackButton onClick={goBack} />
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
                transition={springTransition}
                className="flex flex-col gap-5"
              >
                <SectionTitle>Confirmación</SectionTitle>

                <motion.div
                  variants={itemVariants}
                  className="flex flex-col items-center gap-4 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-md"
                >
                  <motion.div
                    animate={{
                      borderColor: ["rgba(204,255,0,0.4)", "rgba(204,255,0,0.85)", "rgba(204,255,0,0.4)"],
                    }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    className="h-20 w-20 overflow-hidden rounded-full border-2 bg-white/[0.06]"
                  >
                    {avatarPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "rgba(204,255,0,0.10)" }}>
                        <User size={24} style={{ color: LIME }} />
                      </div>
                    )}
                  </motion.div>

                  <div className="text-center">
                    <p className={`${spaceGrotesk.className} text-[22px] font-black text-white`}>{name || "—"}</p>
                    {edad !== null ? <p className="text-xs text-white/40">{edad} años</p> : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {category ? (
                      <span
                        style={{ backgroundColor: LIME, color: DARK }}
                        className="rounded-full px-3 py-1 text-sm font-black"
                      >
                        {category} categoría
                      </span>
                    ) : null}
                    {positionLabel ? (
                      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/70">
                        {positionLabel}
                      </span>
                    ) : null}
                    {handLabel ? (
                      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/70">
                        {handLabel}
                      </span>
                    ) : null}
                  </div>

                  <p className="flex items-center gap-1 text-sm text-white/55">
                    📍 {[city, province].filter(Boolean).join(", ") || "Sin ubicación"}
                  </p>
                </motion.div>

                <MainButton enabled pending={pending} pulse onClick={handleFinish}>
                  ¡A jugar! →
                </MainButton>

                <div className="flex justify-start">
                  <BackButton onClick={goBack} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <AppleToast message={toast} />
    </main>
  );
}
