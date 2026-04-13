"use client";

import Link from "next/link";
import { Camera, Loader2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  type EditProfileState,
  deleteMyAccount,
  updateMyProfile,
} from "@/app/(player)/perfil/edit/actions";
import { createClient } from "@/utils/supabase/client";

const initial: EditProfileState = { ok: false, message: "" };

const HAND_OPTS = [
  { value: "derecha", label: "Derecha" },
  { value: "izquierda", label: "Izquierda" },
] as const;

const POS_OPTS = [
  { value: "drive", label: "Drive" },
  { value: "reves", label: "Revés" },
  { value: "ambas", label: "Ambas" },
] as const;

function pillClass(active: boolean): string {
  return active
    ? "border-sky-400 bg-sky-50 text-sky-900"
    : "border-slate-100 bg-slate-50/50 text-slate-700 hover:border-slate-200";
}

export function EditProfileForm({
  defaultName,
  defaultAge,
  defaultBio,
  defaultAvatarUrl,
  defaultCourtPosition,
  defaultPreferredHand,
}: {
  defaultName: string;
  defaultAge: number | null;
  defaultBio: string | null;
  defaultAvatarUrl: string | null;
  defaultCourtPosition: string;
  defaultPreferredHand: string;
}) {
  const [state, formAction, pending] = useActionState(updateMyProfile, initial);
  const [courtPosition, setCourtPosition] = useState(defaultCourtPosition);
  const [preferredHand, setPreferredHand] = useState(defaultPreferredHand);
  const [deletePending, startDelete] = useTransition();
  const [previewUrl, setPreviewUrl] = useState(defaultAvatarUrl);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      <form action={formAction} className="space-y-6" encType="multipart/form-data">
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

        <input type="hidden" name="court_position" value={courtPosition} />
        <input type="hidden" name="preferred_hand" value={preferredHand} />
        <input type="hidden" name="current_avatar_url" value={defaultAvatarUrl ?? ""} />

        <div className="flex justify-center">
          <div className="relative">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview local o URL pública
              <img
                src={previewUrl}
                alt="Preview del avatar"
                className="h-28 w-28 rounded-full object-cover ring-4 ring-sky-100"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 text-4xl font-semibold text-white ring-4 ring-sky-100">
                {(defaultName.trim()[0] ?? "J").toUpperCase()}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-slate-900 text-white shadow-lg transition hover:bg-slate-800"
              aria-label="Cambiar foto de perfil"
            >
              <Camera size={18} />
            </button>
            <input
              ref={fileInputRef}
              name="avatar_file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
                if (!file) return;
                const objectUrl = URL.createObjectURL(file);
                setPreviewUrl((prev) => {
                  if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                  return objectUrl;
                });
              }}
            />
          </div>
        </div>
        <p className="text-center text-xs text-slate-500">
          Tocá la cámara para subir tu foto. {selectedFile ? "Imagen lista para guardar." : ""}
        </p>

        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</span>
          <input
            name="name"
            type="text"
            required
            autoComplete="name"
            defaultValue={defaultName}
            maxLength={120}
            className="w-full rounded-3xl border border-slate-200/90 bg-white px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200/50"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Edad <span className="font-normal normal-case text-slate-400">(opcional)</span>
          </span>
          <input
            name="age"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Ej. 28"
            defaultValue={defaultAge ?? ""}
            className="w-full rounded-3xl border border-slate-200/90 bg-white px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200/50"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Descripción del perfil
          </span>
          <textarea
            name="bio"
            rows={4}
            maxLength={2000}
            placeholder="Contá un poco sobre vos, tu estilo de juego…"
            defaultValue={defaultBio ?? ""}
            className="w-full resize-y rounded-3xl border border-slate-200/90 bg-white px-4 py-3.5 text-sm leading-relaxed text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200/50"
          />
        </label>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Posición</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {POS_OPTS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setCourtPosition(o.value)}
                className={`min-w-[5.5rem] flex-1 rounded-2xl border py-3 text-sm font-medium transition sm:flex-none sm:px-4 ${pillClass(courtPosition === o.value)}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mano hábil</p>
          <div className="mt-2 flex gap-2">
            {HAND_OPTS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setPreferredHand(o.value)}
                className={`flex-1 rounded-2xl border py-3 text-sm font-medium transition ${pillClass(preferredHand === o.value)}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={pending}
            className="flex flex-1 items-center justify-center gap-2 rounded-3xl bg-sky-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-sky-500 disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar cambios"
            )}
          </button>
          <Link
            href="/perfil"
            className="flex flex-1 items-center justify-center rounded-3xl border border-slate-200 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Volver
          </Link>
        </div>
      </form>

      <div className="border-t border-slate-100 pt-8">
        <button
          type="button"
          disabled={deletePending}
          onClick={() => void handleDeleteAccount()}
          className="w-full rounded-2xl border border-rose-200/90 bg-white py-3.5 text-sm font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-50/50 disabled:opacity-50"
        >
          {deletePending ? "Eliminando…" : "Eliminar cuenta"}
        </button>
      </div>
    </div>
  );
}
