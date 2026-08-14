"use client";

import { Space_Grotesk } from "next/font/google";
import Image from "next/image";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { AppleToast } from "@/components/apple-toast";
import { firebaseAuth } from "@/lib/firebase";
import { createClient } from "@/utils/supabase/client";
import { completarPerfilAction } from "./actions";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] });

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

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
        selected
          ? "border-[#0085FC] bg-[#0085FC] text-white"
          : "border-white/15 bg-transparent text-white/70 hover:border-white/30"
      }`}
    >
      {label}
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export default function CompletarPerfilClient() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Sección 1 — tus datos
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<"masculino" | "femenino" | "">("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Sección 2 — sobre tu juego
  const [preferredHand, setPreferredHand] = useState<"derecha" | "izquierda" | "ambas" | "">("");
  const [courtPosition, setCourtPosition] = useState<"drive" | "reves" | "ambas" | "">("");
  const [preferredSchedule, setPreferredSchedule] = useState<"manana" | "tarde" | "noche" | "cualquiera" | "">("");
  const [category, setCategory] = useState("");

  // Sección 3 — teléfono
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    return () => {
      recaptchaVerifierRef.current?.clear();
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

  function getRecaptchaVerifier(): RecaptchaVerifier {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(firebaseAuth, "recaptcha-container", {
        size: "invisible",
      });
    }
    return recaptchaVerifierRef.current;
  }

  async function handleSendCode() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) {
      showToast("Ingresá un número de teléfono válido.");
      return;
    }
    setSendingCode(true);
    try {
      const verifier = getRecaptchaVerifier();
      const fullPhone = `+54${digits}`;
      const result = await signInWithPhoneNumber(firebaseAuth, fullPhone, verifier);
      confirmationRef.current = result;
      setOtpSent(true);
      setOtpCode("");
      setCooldown(OTP_COOLDOWN_SECONDS);
      showToast("Te enviamos un código por SMS.");
    } catch {
      showToast("No se pudo enviar el SMS. Verificá el número e intentá de nuevo.");
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
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
      await confirmationRef.current.confirm(otpCode);
      setPhoneVerified(true);
      showToast("Teléfono verificado.");
    } catch {
      showToast("Código incorrecto o expirado. Probá de nuevo.");
    } finally {
      setVerifyingCode(false);
    }
  }

  const canSubmit =
    firstName.trim() &&
    lastName.trim() &&
    gender &&
    preferredHand &&
    courtPosition &&
    preferredSchedule &&
    category &&
    phoneVerified;

  function handleFinish() {
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await completarPerfilAction({
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
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
    <main className="min-h-dvh" style={{ background: "#0C1829" }}>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="flex flex-col items-center text-center">
          <Image src="/logo.png" alt="PadeLibre" width={56} height={56} className="rounded-2xl" />
          <h1 className={`${spaceGrotesk.className} mt-4 text-2xl font-bold text-white`}>Completá tu perfil</h1>
          <p className="mt-1.5 text-sm text-white/50">
            Solo te pedimos esto una vez. Después siempre entrás directo.
          </p>
        </div>

        <Card title="Tus datos">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-24 w-24 overflow-hidden rounded-full border border-white/15 bg-white/[0.06]"
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
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Tu nombre"
                className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white placeholder:text-white/30 outline-none focus:border-[#0085FC]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-white/60">Apellido</span>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Tu apellido"
                className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white placeholder:text-white/30 outline-none focus:border-[#0085FC]"
              />
            </label>
          </div>

          <div>
            <span className="text-xs font-semibold text-white/60">Género</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["masculino", "femenino"] as const).map((g) => (
                <Chip key={g} label={g === "masculino" ? "Masculino" : "Femenino"} selected={gender === g} onClick={() => setGender(g)} />
              ))}
            </div>
          </div>
        </Card>

        <Card title="Sobre tu juego">
          <div>
            <span className="text-xs font-semibold text-white/60">Mano hábil</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
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

          <div>
            <span className="text-xs font-semibold text-white/60">Posición en cancha</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
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

          <div>
            <span className="text-xs font-semibold text-white/60">Horario favorito</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
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

          <div>
            <span className="text-xs font-semibold text-white/60">Categoría</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {CATEGORIES.map((opt) => (
                <Chip key={opt.value} label={opt.value} selected={category === opt.value} onClick={() => setCategory(opt.value)} />
              ))}
            </div>
            {category ? (
              <p className="mt-2 text-xs text-white/50">
                {CATEGORIES.find((c) => c.value === category)?.description}
              </p>
            ) : null}
            {category ? (
              <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-3 text-xs leading-relaxed text-amber-200">
                ⚠️ Elegí tu categoría con honestidad. Si mentís, no vas a poder unirte a partidos con tus amigos
                ni a torneos de tu nivel.
              </div>
            ) : null}
          </div>
        </Card>

        <Card title="Verificá tu teléfono">
          {!phoneVerified ? (
            <>
              <div className="flex gap-2">
                <span className="flex items-center rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-[15px] font-medium text-white/70">
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
                  className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white placeholder:text-white/30 outline-none focus:border-[#0085FC] disabled:opacity-50"
                />
              </div>
              <p className="text-xs text-white/40">Te mandamos un SMS al número ingresado.</p>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={() => void handleSendCode()}
                  disabled={sendingCode}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] py-3 text-sm font-semibold text-white disabled:opacity-60"
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
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-4 text-center text-2xl tracking-[0.3em] text-white placeholder:text-white/20 outline-none focus:border-[#0085FC]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleVerifyCode()}
                    disabled={verifyingCode || otpCode.length !== 6}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0085FC] py-3 text-sm font-semibold text-white disabled:opacity-60"
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
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-3 text-sm font-semibold text-emerald-300">
              <Check size={16} strokeWidth={3} />
              Teléfono verificado
            </div>
          )}
          <div id="recaptcha-container" />
        </Card>

        {canSubmit ? (
          <button
            type="button"
            onClick={handleFinish}
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-[#0085FC] to-[#0461C4] py-3.5 text-base font-bold text-white shadow-[0_8px_24px_rgba(0,133,252,0.25)] disabled:opacity-60"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : null}
            Guardar y empezar a jugar
          </button>
        ) : null}
      </div>
      <AppleToast message={toast} />
    </main>
  );
}
