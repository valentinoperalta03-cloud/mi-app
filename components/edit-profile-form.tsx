"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  type EditProfileState,
  deleteMyAccount,
  updateMyPhone,
  updateMyProfile,
} from "@/app/(player)/perfil/edit/actions";
import { logoutOneSignal } from "@/lib/onesignal-native";
import { arMobileInputValue, arMobileProblem, formatArMobile, normalizeArMobile } from "@/lib/phone-ar";
import { createClient } from "@/utils/supabase/client";

const initial: EditProfileState = { ok: false, message: "" };

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const CATEGORIES = ["8va", "7ma", "6ta", "5ta", "4ta", "3ra", "2da", "1ra"];

export function EditProfileForm({
  userId,
  defaultName,
  defaultAge,
  defaultBio,
  defaultAvatarUrl,
  defaultGender,
  defaultPreferredHand,
  defaultCourtPosition,
  defaultPreferredSchedule,
  defaultCategory,
  defaultPhone,
}: {
  userId: string;
  defaultName: string;
  defaultAge: number | null;
  defaultBio: string | null;
  defaultAvatarUrl: string | null;
  defaultGender: "masculino" | "femenino" | null;
  defaultPreferredHand: string | null;
  defaultCourtPosition: string | null;
  defaultPreferredSchedule: string | null;
  defaultCategory: string | null;
  defaultPhone: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateMyProfile, initial);
  const [deletePending, startDelete] = useTransition();
  const [previewUrl, setPreviewUrl] = useState(defaultAvatarUrl);
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatarUrl ?? "");
  const [gender, setGender] = useState<"masculino" | "femenino">(defaultGender ?? "masculino");
  const [preferredHand, setPreferredHand] = useState<string>(defaultPreferredHand ?? "derecha");
  const [courtPosition, setCourtPosition] = useState<string>(defaultCourtPosition ?? "drive");
  const [preferredSchedule, setPreferredSchedule] = useState<string>(defaultPreferredSchedule ?? "cualquiera");
  const [category, setCategory] = useState<string>(defaultCategory ?? "8va");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Seleccioná una imagen válida.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setUploadError("La imagen supera 5MB. Elegí un archivo más liviano.");
      return;
    }
    setUploadingAvatar(true);
    setUploadError(null);
    const supabase = createClient();
    const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type || "image/png",
    });
    if (error) {
      setUploadError(`No se pudo subir la imagen: ${error.message}`);
      setUploadingAvatar(false);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
    const nextUrl = `${publicUrl}?v=${Date.now()}`;
    setAvatarUrl(nextUrl);
    setPreviewUrl(nextUrl);
    setUploadingAvatar(false);
  }

  async function handleDeleteAccount() {
    if (
      !window.confirm(
        "¿Seguro que querés eliminar tu cuenta? Se borrarán tus datos de acceso y no podrás recuperarlos."
      )
    ) {
      return;
    }
    startDelete(async () => {
      const res = await deleteMyAccount();
      if (!res.ok) {
        window.alert(res.message);
        return;
      }
      const supabase = createClient();
      try {
        await supabase.auth.signOut();
      } finally {
        await logoutOneSignal();
      }
      router.replace("/login");
      router.refresh();
    });
  }

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="space-y-8">
      <form
        action={formAction}
        className="space-y-6"
        onSubmit={(e) => {
          if (uploadingAvatar) {
            e.preventDefault();
          }
        }}
      >
        {state.message ? (
          <p
            role={state.ok ? "status" : "alert"}
            className={
              state.ok
                ? "rounded-3xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-900"
                : "rounded-3xl border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-900"
            }
          >
            {state.message}
          </p>
        ) : null}

        <input type="hidden" name="avatar_url" value={avatarUrl} />

        <div className="flex justify-center">
          <div className="relative">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview local o URL pública
              <img
                src={previewUrl}
                alt="Preview del avatar"
                className="h-28 w-28 rounded-full object-cover ring-4 ring-[#0085FC]/40"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-[#0085FC] to-cyan-500 text-4xl font-semibold text-white ring-4 ring-[#0085FC]/40">
                {(defaultName.trim()[0] ?? "J").toUpperCase()}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-slate-900 text-white shadow-lg transition hover:bg-slate-800 dark:border-slate-600"
              aria-label="Cambiar foto de perfil"
            >
              <Camera size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0] ?? null;
                if (!file) return;
                const objectUrl = URL.createObjectURL(file);
                setPreviewUrl((prev) => {
                  if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                  return objectUrl;
                });
                await handleImageUpload(file);
              }}
            />
          </div>
        </div>
        <p className="text-center text-xs text-[var(--text-tertiary)]">
          La imagen se sube a Storage desde tu navegador.{" "}
          {uploadingAvatar ? "Subiendo imagen..." : ""}
        </p>
        {uploadError ? <p className="text-center text-xs text-rose-600">{uploadError}</p> : null}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Nombre</span>
          <input
            name="name"
            type="text"
            required
            autoComplete="name"
            defaultValue={defaultName}
            maxLength={120}
            className="w-full rounded-xl border px-4 py-3 text-sm transition-colors bg-[var(--bg-input)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[#0085FC] focus:outline-none focus:ring-2 focus:ring-[#0085FC]/20"
          />
        </label>

        <PhoneEditor defaultPhone={defaultPhone} />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Edad <span className="font-normal normal-case text-[var(--text-tertiary)]">(opcional)</span>
          </span>
          <input
            name="age"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Ej. 28"
            defaultValue={defaultAge ?? ""}
            className="w-full rounded-xl border px-4 py-3 text-sm transition-colors bg-[var(--bg-input)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[#0085FC] focus:outline-none focus:ring-2 focus:ring-[#0085FC]/20"
          />
        </label>

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Sexo</span>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setGender("masculino")}
              aria-pressed={gender === "masculino"}
              className={`rounded-3xl border px-4 py-4 text-sm font-semibold transition ${
                gender === "masculino"
                  ? "border-[#0085FC]/20 bg-[#0085FC] text-white shadow-sm dark:bg-sky-500"
                  : "bg-transparent border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              Masculino
            </button>
            <button
              type="button"
              onClick={() => setGender("femenino")}
              aria-pressed={gender === "femenino"}
              className={`rounded-3xl border px-4 py-4 text-sm font-semibold transition ${
                gender === "femenino"
                  ? "border-[#0085FC]/20 bg-[#0085FC] text-white shadow-sm dark:bg-sky-500"
                  : "bg-transparent border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              Femenino
            </button>
          </div>
          <input type="hidden" name="gender" value={gender} />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Categoría
          </span>
          <p className="text-xs text-[var(--text-tertiary)]">
            Elegí tu nivel real — esto define con quién podés jugar
          </p>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                aria-pressed={category === cat}
                className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${
                  category === cat
                    ? "border-[#0085FC]/20 bg-[#0085FC] text-white shadow-sm"
                    : "border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)]/70">
            8va = principiante · 1ra = avanzado
          </p>
          <input type="hidden" name="category" value={category} />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            Descripción del perfil
          </span>
          <textarea
            name="bio"
            rows={4}
            maxLength={2000}
            placeholder="Contá un poco sobre vos, tu estilo de juego…"
            defaultValue={defaultBio ?? ""}
            className="w-full rounded-xl border px-4 py-3 text-sm transition-colors bg-[var(--bg-input)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[#0085FC] focus:outline-none focus:ring-2 focus:ring-[#0085FC]/20"
          />
        </label>

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Mano hábil</span>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "derecha", label: "Derecha" },
              { value: "izquierda", label: "Izquierda" },
              { value: "ambas", label: "Ambas" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPreferredHand(option.value)}
                aria-pressed={preferredHand === option.value}
                className={`rounded-3xl border px-4 py-4 text-sm font-semibold transition ${
                  preferredHand === option.value
                    ? "border-[#0085FC]/20 bg-[#0085FC] text-white shadow-sm dark:bg-sky-500"
                    : "bg-transparent border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="preferred_hand" value={preferredHand} />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Posición en cancha</span>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "drive", label: "Drive" },
              { value: "reves", label: "Revés" },
              { value: "ambas", label: "Ambas" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setCourtPosition(option.value)}
                aria-pressed={courtPosition === option.value}
                className={`rounded-3xl border px-4 py-4 text-sm font-semibold transition ${
                  courtPosition === option.value
                    ? "border-[#0085FC]/20 bg-[#0085FC] text-white shadow-sm dark:bg-sky-500"
                    : "bg-transparent border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="court_position" value={courtPosition} />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Horario favorito</span>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "manana", label: "Mañana" },
              { value: "tarde", label: "Tarde" },
              { value: "noche", label: "Noche" },
              { value: "cualquiera", label: "Cualquiera" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPreferredSchedule(option.value)}
                aria-pressed={preferredSchedule === option.value}
                className={`rounded-3xl border px-4 py-4 text-sm font-semibold transition ${
                  preferredSchedule === option.value
                    ? "border-[#0085FC]/20 bg-[#0085FC] text-white shadow-sm dark:bg-sky-500"
                    : "bg-transparent border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="preferred_schedule" value={preferredSchedule} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={pending || uploadingAvatar}
            className="flex flex-1 items-center justify-center gap-2 rounded-3xl bg-[#0461C4] py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#0085FC]/50 disabled:opacity-50"
          >
            {pending || uploadingAvatar ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {uploadingAvatar ? "Subiendo imagen..." : "Guardando..."}
              </>
            ) : (
              "Guardar cambios"
            )}
          </button>
          <Link
            href="/perfil"
            className="flex flex-1 items-center justify-center rounded-3xl bg-transparent border border-[var(--border-subtle)] py-3.5 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)]"
          >
            Volver
          </Link>
        </div>
      </form>

      <div className="border-t border-[var(--border-subtle)] pt-8">
        <button
          type="button"
          disabled={deletePending}
          onClick={() => void handleDeleteAccount()}
          className="w-full rounded-2xl border border-rose-200/90 bg-white dark:bg-slate-900 py-3.5 text-sm font-medium text-rose-600 dark:text-rose-400 transition hover:border-rose-300 hover:bg-rose-50/50 dark:border-rose-800 dark:hover:bg-rose-950/30 disabled:opacity-50"
        >
          {deletePending ? "Eliminando…" : "Eliminar cuenta"}
        </button>
      </div>
    </div>
  );
}

// El número lo declara el jugador: se normaliza, se confirma y se guarda con
// update_my_phone(). No se verifica propiedad, así que nunca se muestra como
// "verificado" (ni siquiera si Auth tiene otro número confirmado por OTP).
function PhoneEditor({ defaultPhone }: { defaultPhone: string | null }) {
  const [saved, setSaved] = useState(defaultPhone);
  const [mode, setMode] = useState<"view" | "edit" | "review">("view");
  const [input, setInput] = useState("");
  const [touched, setTouched] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const normalized = normalizeArMobile(input);
  const problem = touched && !normalized ? arMobileProblem(input) : null;
  const savedNormalized = normalizeArMobile(saved ?? "");
  const savedLabel = savedNormalized ? formatArMobile(savedNormalized) : saved || "Sin número";

  function startEdit() {
    setInput(arMobileInputValue(savedNormalized));
    setTouched(false);
    setMessage(null);
    setMode("edit");
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  function review() {
    setTouched(true);
    if (normalized) setMode("review");
  }

  function save() {
    if (!normalized) return;
    startSaving(async () => {
      const res = await updateMyPhone(normalized, true);
      if (!res.ok) {
        setMessage({ ok: false, text: res.message });
        setMode("edit");
        return;
      }
      setSaved(res.phone);
      setMode("view");
      setMessage({ ok: true, text: "Número actualizado y confirmado por vos." });
    });
  }

  const fieldClass =
    "w-full rounded-xl border px-4 py-3 text-sm transition-colors bg-[var(--bg-input)] border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[#0085FC] focus:outline-none focus:ring-2 focus:ring-[#0085FC]/20";

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Teléfono</span>

      {mode === "view" ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-sm text-[var(--text-primary)]">
          <span className="font-mono tracking-wide">{savedLabel}</span>
          <button
            type="button"
            onClick={startEdit}
            className="min-h-[44px] shrink-0 rounded-lg px-2 text-sm font-semibold text-[#0461C4] hover:underline dark:text-sky-400"
          >
            {saved ? "Cambiar" : "Agregar"}
          </button>
        </div>
      ) : mode === "review" && normalized ? (
        <div className="rounded-2xl border-2 border-[#0085FC]/40 bg-[var(--bg-subtle)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">¿Este es tu número correcto?</p>
          <p className="mt-2 font-mono text-xl tracking-wide text-[var(--text-primary)]">{formatArMobile(normalized)}</p>
          <p className="mt-2 text-xs leading-snug text-[var(--text-tertiary)]">
            Si lo ingresás mal, el club podría no poder avisarte ante cualquier inconveniente con tu turno.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0461C4] text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              Sí, es mi número
            </button>
            <button
              type="button"
              onClick={() => setMode("edit")}
              disabled={saving}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl border border-[var(--border-subtle)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
            >
              Corregir número
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <span className="flex shrink-0 items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 font-mono text-sm text-[var(--text-secondary)]">
              +54
            </span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/[^\d\s()+-]/g, ""))}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  review();
                }
              }}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="11 2233 4455"
              aria-label="Número de celular"
              aria-invalid={Boolean(problem) || undefined}
              className={`${fieldClass} min-w-0 flex-1 font-mono`}
            />
          </div>
          <p className={`text-xs leading-snug ${problem ? "text-rose-600" : "text-[var(--text-tertiary)]"}`}>
            {normalized
              ? `Se va a guardar como ${formatArMobile(normalized)}`
              : problem ?? "Con código de área, sin el 0 ni el 15."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={review}
              disabled={!normalized}
              className="min-h-[44px] flex-1 rounded-2xl bg-[#0461C4] text-sm font-semibold text-white disabled:opacity-40"
            >
              Confirmar número
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("view");
                setMessage(null);
              }}
              className="min-h-[44px] rounded-2xl border border-[var(--border-subtle)] px-4 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {message ? (
        <p role={message.ok ? "status" : "alert"} className={`mt-1.5 text-xs ${message.ok ? "text-emerald-600" : "text-rose-600"}`}>
          {message.text}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
          Es el número por el que el club puede avisarte si surge algún inconveniente con tu reserva.
        </p>
      )}
    </div>
  );
}
