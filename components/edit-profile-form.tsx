"use client";

import Link from "next/link";
import { Camera, Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { splitOfficialCategoryLine } from "@/lib/profile-display";
import {
  type EditProfileState,
  deleteMyAccount,
  updateMyProfile,
} from "@/app/(player)/perfil/edit/actions";
import { createClient } from "@/utils/supabase/client";

const initial: EditProfileState = { ok: false, message: "" };

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function EditProfileForm({
  userId,
  defaultName,
  defaultAge,
  defaultBio,
  defaultAvatarUrl,
  defaultGender,
  competitiveLevelLine,
}: {
  userId: string;
  defaultName: string;
  defaultAge: number | null;
  defaultBio: string | null;
  defaultAvatarUrl: string | null;
  defaultGender: "masculino" | "femenino" | null;
  /** Solo lectura: nivel competitivo (no editable acá). */
  competitiveLevelLine: string;
}) {
  const [state, formAction, pending] = useActionState(updateMyProfile, initial);
  const [deletePending, startDelete] = useTransition();
  const [previewUrl, setPreviewUrl] = useState(defaultAvatarUrl);
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatarUrl ?? "");
  const [gender, setGender] = useState<"masculino" | "femenino">(defaultGender ?? "masculino");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const levelParts = splitOfficialCategoryLine(competitiveLevelLine);

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
      await supabase.auth.signOut();
      window.location.href = "/login";
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
                className="h-28 w-28 rounded-full object-cover ring-4 ring-[#0585FC]/40"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-[#0585FC] to-cyan-500 text-4xl font-semibold text-white ring-4 ring-[#0585FC]/40">
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
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          La imagen se sube a Storage desde tu navegador.{" "}
          {uploadingAvatar ? "Subiendo imagen..." : ""}
        </p>
        {uploadError ? <p className="text-center text-xs text-rose-600">{uploadError}</p> : null}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</span>
          <input
            name="name"
            type="text"
            required
            autoComplete="name"
            defaultValue={defaultName}
            maxLength={120}
            className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Edad <span className="font-normal normal-case text-slate-400">(opcional)</span>
          </span>
          <input
            name="age"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Ej. 28"
            defaultValue={defaultAge ?? ""}
            className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
          />
        </label>

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sexo</span>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setGender("masculino")}
              aria-pressed={gender === "masculino"}
              className={`rounded-3xl border px-4 py-4 text-sm font-semibold transition ${
                gender === "masculino"
                  ? "border-[#0585FC]/20 bg-[#0585FC] text-white shadow-sm dark:bg-sky-500"
                  : "bg-transparent border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
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
                  ? "border-[#0585FC]/20 bg-[#0585FC] text-white shadow-sm dark:bg-sky-500"
                  : "bg-transparent border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              Femenino
            </button>
          </div>
          <input type="hidden" name="gender" value={gender} />
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Nivel competitivo
          </p>
          <p className="mt-1 text-sm text-[#0461C4]">
            <span className="font-bold">{levelParts.category || "—"}</span>
            {levelParts.description ? (
              <span className="font-medium">{" - "}{levelParts.description}</span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Se actualiza solo con resultados de partidos y la nivelación inicial. No se puede editar
            acá.
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Descripción del perfil
          </span>
          <textarea
            name="bio"
            rows={4}
            maxLength={2000}
            placeholder="Contá un poco sobre vos, tu estilo de juego…"
            defaultValue={defaultBio ?? ""}
            className="w-full rounded-xl border border-slate-300 bg-transparent dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={pending || uploadingAvatar}
            className="flex flex-1 items-center justify-center gap-2 rounded-3xl bg-[#0461C4] py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#0585FC]/50 disabled:opacity-50"
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
            className="flex flex-1 items-center justify-center rounded-3xl bg-transparent border border-slate-300 dark:border-slate-700 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Volver
          </Link>
        </div>
      </form>

      <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
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
