"use client";

import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import Image from "next/image";
import {
  Camera,
  ChevronLeft,
  Loader2,
  Hand,
  Users,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppleToast } from "@/components/apple-toast";
import { ARGENTINA_PROVINCES } from "@/lib/argentina-provinces";
import { createClient } from "@/utils/supabase/client";
import { completarPerfilAction } from "./actions";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const NAVY = "#0A1628";
const LIME = "#CCFF00";

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

const slideVariants = {
  enter: { x: 40, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -40, opacity: 0 },
};

function Kicker({ step }: { step: Step }) {
  return (
    <span className={`${ibmPlexMono.className} text-[11px] font-medium uppercase tracking-[0.2em] text-[#CCFF00]/70`}>
      Paso {step} / 5
    </span>
  );
}

function ProgressBar({ step }: { step: Step }) {
  return (
    <div className="flex w-full gap-1.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: LIME }}
            initial={false}
            animate={{ width: s <= step ? "100%" : "0%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
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

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{ height: 52, ...style }}
      className={`w-full rounded-2xl border border-white/[0.10] bg-white/[0.06] px-4 text-[15px] text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#CCFF00] ${className ?? ""}`}
    />
  );
}

function BigChip({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ height: 80 }}
      className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border transition-colors duration-150 ${
        selected
          ? `border-transparent bg-[#CCFF00] font-black text-[#0A1628]`
          : "border-white/[0.10] bg-white/[0.06] text-white/70 hover:bg-white/[0.10]"
      }`}
    >
      {icon}
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

function SmallChip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border py-3 text-sm font-bold transition-colors duration-150 ${
        selected
          ? `border-transparent bg-[#CCFF00] text-[#0A1628]`
          : "border-white/[0.10] bg-white/[0.06] text-white/70 hover:bg-white/[0.10]"
      }`}
    >
      {label}
    </button>
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
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl py-3 text-sm font-bold transition-colors duration-150 ${
        selected
          ? `bg-[#CCFF00] text-[#0A1628]`
          : "border border-white/[0.10] bg-white/[0.06] text-white/70 hover:bg-white/[0.10]"
      }`}
    >
      {label}
    </button>
  );
}

function MainButton({
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
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled || pending}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-[#CCFF00] py-4 text-base font-black uppercase tracking-wide text-[#0A1628] transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${spaceGrotesk.className}`}
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
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

  // Paso 1
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(googleAvatarUrl ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(googleAvatarUrl ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Paso 2
  const [gender, setGender] = useState<"masculino" | "femenino" | "">("");
  const [category, setCategory] = useState("");

  // Paso 3
  const [preferredHand, setPreferredHand] = useState<"derecha" | "izquierda" | "">("");
  const [courtPosition, setCourtPosition] = useState<"drive" | "reves" | "ambas" | "">("");

  // Paso 4
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
  const canStep2 = Boolean(gender && category);
  const canStep3 = Boolean(preferredHand && courtPosition);
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

  return (
    <main className="relative min-h-dvh" style={{ backgroundColor: NAVY }}>
      <div style={{ backgroundColor: LIME }} className="h-[2px] w-full" />
      <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-8 px-5 py-6">
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
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-8"
              >
                <SectionTitle>Datos personales</SectionTitle>

                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/[0.10] bg-white/[0.06]"
                  >
                    {avatarPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <Camera size={26} className="text-white/40" />
                    )}
                    <span
                      style={{ backgroundColor: LIME }}
                      className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2"
                    >
                      <Camera size={13} color={NAVY} />
                    </span>
                  </button>
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
                  <p className="text-xs text-white/40">
                    {uploadingAvatar ? "Subiendo foto…" : "Tocá para cambiar tu foto"}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <TextInput
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre completo"
                  />
                  <div>
                    <TextInput
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      max={new Date().toISOString().slice(0, 10)}
                    />
                    {edad !== null ? (
                      <p className="mt-2 text-sm font-bold text-[#CCFF00]">{edad} años</p>
                    ) : null}
                  </div>
                </div>

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
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-8"
              >
                <SectionTitle>Perfil deportivo</SectionTitle>

                <div className="flex flex-col gap-3">
                  <span className="text-sm font-bold text-white/70">Género</span>
                  <div className="flex gap-3">
                    <BigChip
                      selected={gender === "masculino"}
                      onClick={() => setGender("masculino")}
                      icon={<Users size={20} />}
                      label="Caballeros"
                    />
                    <BigChip
                      selected={gender === "femenino"}
                      onClick={() => setGender("femenino")}
                      icon={<Users size={20} />}
                      label="Damas"
                    />
                  </div>
                </div>

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
                  {categoryDescription ? (
                    <p className="text-xs text-white/50">{categoryDescription}</p>
                  ) : null}
                </div>

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
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-8"
              >
                <SectionTitle>Estilo de juego</SectionTitle>

                <div className="flex flex-col gap-3">
                  <span className="text-sm font-bold text-white/70">Mano hábil</span>
                  <div className="flex gap-3">
                    <BigChip
                      selected={preferredHand === "derecha"}
                      onClick={() => setPreferredHand("derecha")}
                      icon={<Hand size={20} />}
                      label="Diestro"
                    />
                    <BigChip
                      selected={preferredHand === "izquierda"}
                      onClick={() => setPreferredHand("izquierda")}
                      icon={<Hand size={20} className="-scale-x-100" />}
                      label="Zurdo"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <span className="text-sm font-bold text-white/70">Posición en cancha</span>
                  <div className="flex gap-2">
                    {[
                      { id: "drive", label: "Drive" },
                      { id: "reves", label: "Revés" },
                      { id: "ambas", label: "Indistinto" },
                    ].map((opt) => (
                      <SmallChip
                        key={opt.id}
                        label={opt.label}
                        selected={courtPosition === opt.id}
                        onClick={() => setCourtPosition(opt.id as "drive" | "reves" | "ambas")}
                      />
                    ))}
                  </div>
                </div>

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
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-8"
              >
                <SectionTitle>Contacto</SectionTitle>

                <div className="flex flex-col gap-3">
                  <span className="text-sm font-bold text-white/70">WhatsApp</span>
                  <div className="flex gap-2">
                    <span
                      style={{ height: 52 }}
                      className="flex items-center rounded-2xl border border-white/[0.10] bg-white/[0.06] px-3 text-[15px] font-medium text-white/70"
                    >
                      +54
                    </span>
                    <TextInput
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                      inputMode="numeric"
                      placeholder="91122334455"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <span className="text-sm font-bold text-white/70">Provincia</span>
                  <select
                    value={province}
                    onChange={(e) => {
                      setProvince(e.target.value);
                      setCity("");
                    }}
                    style={{ height: 52 }}
                    className="w-full rounded-2xl border border-white/[0.10] bg-white/[0.06] px-4 text-[15px] text-white outline-none focus:border-[#CCFF00]"
                  >
                    <option value="" disabled style={{ backgroundColor: NAVY }} className="text-white/35">
                      Seleccioná tu provincia
                    </option>
                    {ARGENTINA_PROVINCES.map((prov) => (
                      <option key={prov.code} value={prov.name} style={{ backgroundColor: NAVY }} className="text-white">
                        {prov.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-3">
                  <span className="text-sm font-bold text-white/70">Ciudad</span>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={!province}
                    style={{ height: 52 }}
                    className="w-full rounded-2xl border border-white/[0.10] bg-white/[0.06] px-4 text-[15px] text-white outline-none focus:border-[#CCFF00] disabled:opacity-40"
                  >
                    <option value="" disabled style={{ backgroundColor: NAVY }} className="text-white/35">
                      {province ? "Seleccioná tu ciudad" : "Elegí primero tu provincia"}
                    </option>
                    {(ARGENTINA_PROVINCES.find((prov) => prov.name === province)?.cities ?? []).map(
                      (cityName) => (
                        <option key={cityName} value={cityName} style={{ backgroundColor: NAVY }} className="text-white">
                          {cityName}
                        </option>
                      )
                    )}
                  </select>
                </div>

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
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-8"
              >
                <SectionTitle>Confirmación</SectionTitle>

                <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/[0.10] bg-white/[0.06] p-6">
                  <div className="h-20 w-20 overflow-hidden rounded-full border border-white/[0.10] bg-white/[0.08]">
                    {avatarPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Camera size={22} className="text-white/40" />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className={`${spaceGrotesk.className} text-lg font-bold text-white`}>{name || "—"}</p>
                    {edad !== null ? <p className="text-xs text-white/40">{edad} años</p> : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {category ? (
                      <span
                        style={{ backgroundColor: LIME, color: NAVY }}
                        className="rounded-full px-3 py-1 text-xs font-black uppercase"
                      >
                        {category} categoría
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/[0.10] bg-white/[0.06] px-3 py-1 text-xs font-bold text-white/70">
                      {courtPosition === "drive" ? "Drive" : courtPosition === "reves" ? "Revés" : "Indistinto"}
                    </span>
                  </div>

                  <p className="text-sm text-white/50">
                    {[city, province].filter(Boolean).join(", ") || "Sin ubicación"}
                  </p>
                </div>

                <MainButton enabled pending={pending} onClick={handleFinish}>
                  Comenzar ahora →
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
