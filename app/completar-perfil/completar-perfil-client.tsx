"use client";

import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import Image from "next/image";
import { Camera, ChevronLeft, Loader2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppleToast } from "@/components/apple-toast";
import { ARGENTINA_PROVINCES } from "@/lib/argentina-provinces";
import { createClient } from "@/utils/supabase/client";
import { completarPerfilAction } from "./actions";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[15px] font-bold text-white">{children}</span>;
}

function Chip({
  label,
  selected,
  onClick,
  minHeight = 48,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  minHeight?: number;
}) {
  const [bump, setBump] = useState(0);
  return (
    <motion.button
      key={bump}
      type="button"
      onClick={() => {
        onClick();
        setBump((b) => b + 1);
      }}
      style={{ minHeight }}
      initial={{ scale: 1 }}
      animate={selected ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`flex flex-1 items-center justify-center rounded-xl border px-3 text-sm transition-colors duration-150 hover:bg-white/[0.12] ${
        selected
          ? "border-[#0085FC] bg-[#0085FC]/20 font-bold text-white"
          : "border-white/[0.12] bg-white/[0.08] text-white/75"
      }`}
    >
      {label}
    </motion.button>
  );
}

function ProgressIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <span className={`${ibmPlexMono.className} text-[11px] uppercase tracking-[0.12em] text-white/40`}>
        Paso {step} de 2
      </span>
      <div className="h-[3px] w-full rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-[#CCFF00]"
          animate={{ width: step === 1 ? "50%" : "100%" }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

const slideVariants = {
  enter: { x: 40, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -40, opacity: 0 },
};

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
    <motion.div
      key={enabled ? "enabled" : "disabled"}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!enabled || pending}
        style={{
          minHeight: 56,
          boxShadow: enabled ? "0 4px 20px rgba(0,133,252,0.40)" : "none",
        }}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 ${spaceGrotesk.className}`}
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : null}
        {children}
      </button>
    </motion.div>
  );
}

export default function CompletarPerfilClient() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2>(1);

  // Pantalla 1 — sobre vos
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"masculino" | "femenino" | "">("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");

  // Pantalla 2 — tu juego
  const [preferredHand, setPreferredHand] = useState<"derecha" | "izquierda" | "ambas" | "">("");
  const [courtPosition, setCourtPosition] = useState<"drive" | "reves" | "ambas" | "">("");
  const [preferredSchedule, setPreferredSchedule] = useState<"manana" | "tarde" | "noche" | "cualquiera" | "">("");
  const [category, setCategory] = useState("");

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

  const canSubmitStep1 = Boolean(
    name.trim() && gender && phone.replace(/\D/g, "").length >= 8 && province
  );
  const canSubmitStep2 = Boolean(preferredHand && courtPosition && preferredSchedule && category);

  function goToStep2() {
    if (!canSubmitStep1) return;
    setStep(2);
  }

  function goToStep1() {
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
        province,
        city: city.trim(),
      });
      if (res && !res.ok) {
        showToast(res.message);
      }
    });
  }

  return (
    <main className="min-h-dvh" style={{ backgroundColor: "#0C1829" }}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-8 px-5 py-6">
        <div className="flex flex-col items-center gap-5">
          <Image src="/logo.png" alt="PadeLibre" width={32} height={32} className="rounded-lg" />
          <ProgressIndicator step={step} />
        </div>

        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {step === 1 ? (
              <motion.div
                key="step1"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-8"
              >
                <div className="flex flex-col items-center gap-4 text-center">
                  <span style={{ fontSize: 80, lineHeight: 1 }}>🎾</span>
                  <div>
                    <h1 className={`${spaceGrotesk.className} text-[28px] font-bold text-white`}>
                      ¡Hola! Contanos sobre vos
                    </h1>
                    <p className="mt-1.5 text-sm text-white/55">
                      Solo te pedimos esto una vez. Después siempre entrás directo.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <SectionLabel>Tu nombre</SectionLabel>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.08]"
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
                    style={{ height: 52 }}
                    className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.08] px-4 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-[#0085FC]"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <SectionLabel>Tu género</SectionLabel>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setGender("masculino")}
                      style={{ height: 56 }}
                      className={`w-1/2 rounded-2xl border text-[15px] font-semibold transition-colors duration-200 ${
                        gender === "masculino"
                          ? "border-transparent bg-[#0085FC] font-bold text-white"
                          : "border-white/[0.12] bg-white/[0.08] text-white/75"
                      }`}
                    >
                      ♂ Masculino
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender("femenino")}
                      style={{ height: 56 }}
                      className={`w-1/2 rounded-2xl border text-[15px] font-semibold transition-colors duration-200 ${
                        gender === "femenino"
                          ? "border-transparent bg-[#0085FC] font-bold text-white"
                          : "border-white/[0.12] bg-white/[0.08] text-white/75"
                      }`}
                    >
                      ♀ Femenino
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <SectionLabel>Tu teléfono</SectionLabel>
                  <p className="text-[13px] leading-relaxed text-white/55">
                    Los clubes donde reservés van a poder escribirte si hay alguna novedad. Tu número nunca se
                    comparte públicamente.
                  </p>
                  <div className="flex gap-2">
                    <span
                      style={{ height: 52 }}
                      className="flex items-center rounded-2xl border border-white/[0.12] bg-white/[0.08] px-3 text-[15px] font-medium text-white/70"
                    >
                      +54
                    </span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                      inputMode="numeric"
                      placeholder="91122334455"
                      style={{ height: 52 }}
                      className="flex-1 rounded-2xl border border-white/[0.12] bg-white/[0.08] px-4 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-[#0085FC]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <SectionLabel>¿Dónde jugás?</SectionLabel>
                  <select
                    value={province}
                    onChange={(e) => {
                      setProvince(e.target.value);
                      setCity("");
                    }}
                    style={{ height: 52 }}
                    className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.08] px-4 text-[15px] text-white outline-none focus:border-[#0085FC]"
                  >
                    <option value="" disabled className="bg-[#0C1829] text-white/35">
                      Seleccioná tu provincia
                    </option>
                    {ARGENTINA_PROVINCES.map((prov) => (
                      <option key={prov.code} value={prov.name} className="bg-[#0C1829] text-white">
                        {prov.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={!province}
                    style={{ height: 52 }}
                    className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.08] px-4 text-[15px] text-white outline-none focus:border-[#0085FC] disabled:opacity-40"
                  >
                    <option value="" disabled className="bg-[#0C1829] text-white/35">
                      {province ? "Seleccioná tu ciudad" : "Elegí primero tu provincia"}
                    </option>
                    {(ARGENTINA_PROVINCES.find((prov) => prov.name === province)?.cities ?? []).map(
                      (cityName) => (
                        <option key={cityName} value={cityName} className="bg-[#0C1829] text-white">
                          {cityName}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <MainButton enabled={canSubmitStep1} onClick={goToStep2}>
                  Continuar — casi listo 👊
                </MainButton>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col gap-8"
              >
                <button
                  type="button"
                  onClick={goToStep1}
                  className="flex items-center gap-1 self-start text-sm font-medium text-white/50 transition hover:text-white/80"
                >
                  <ChevronLeft size={16} />
                  Volver
                </button>

                <div className="flex flex-col items-center gap-4 text-center">
                  <span style={{ fontSize: 80, lineHeight: 1 }}>⚡</span>
                  <div>
                    <h1 className={`${spaceGrotesk.className} text-[28px] font-bold text-white`}>¿Cómo jugás?</h1>
                    <p className="mt-1.5 text-sm text-white/55">
                      Esto nos ayuda a encontrarte los mejores partidos.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <SectionLabel>Tu mano hábil</SectionLabel>
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
                </div>

                <div className="flex flex-col gap-3">
                  <SectionLabel>Tu posición en cancha</SectionLabel>
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
                </div>

                <div className="flex flex-col gap-3">
                  <SectionLabel>Tu horario favorito</SectionLabel>
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
                </div>

                <div className="flex flex-col gap-3">
                  <SectionLabel>Tu categoría</SectionLabel>
                  <div
                    style={{ borderLeftWidth: 3, borderLeftColor: "#FFC107", backgroundColor: "rgba(255,193,7,0.10)" }}
                    className="rounded-[10px] px-4 py-3 text-[13px] leading-relaxed"
                  >
                    <span style={{ color: "#FFC107" }}>
                      ⚠️ Elegí tu categoría con honestidad. Si mentís, no vas a poder unirte a partidos con tus
                      amigos.
                    </span>
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
                </div>

                <MainButton enabled={canSubmitStep2} pending={pending} onClick={handleFinish}>
                  ¡Listo, a jugar! 🎾
                </MainButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <AppleToast message={toast} />
    </main>
  );
}
