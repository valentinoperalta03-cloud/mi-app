"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  type EditProfileState,
  updateMyProfile,
} from "@/app/(player)/perfil/edit/actions";
import { PROFILE_CATEGORIES } from "@/lib/profile-display";

const initial: EditProfileState = { ok: false, message: "" };

export function EditProfileForm({
  defaultAvatarUrl,
  defaultCategory,
}: {
  defaultAvatarUrl: string | null;
  defaultCategory: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateMyProfile, initial);

  return (
    <form action={formAction} className="space-y-6">
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

      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          URL de la foto
        </span>
        <input
          name="avatar_url"
          type="url"
          placeholder="https://..."
          defaultValue={defaultAvatarUrl ?? ""}
          className="w-full rounded-3xl border border-slate-200/90 bg-white px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200/50"
        />
        <p className="text-xs text-slate-500">Podés usar un enlace público a tu imagen (HTTPS).</p>
      </label>

      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Categoría inicial
        </span>
        <select
          name="category"
          defaultValue={defaultCategory ?? ""}
          className="w-full rounded-3xl border border-slate-200/90 bg-white px-4 py-3.5 text-sm font-medium text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200/50"
        >
          <option value="">Sin definir</option>
          {PROFILE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-3xl bg-sky-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-sky-500 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        <Link
          href="/perfil"
          className="flex flex-1 items-center justify-center rounded-3xl border border-slate-200 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Volver
        </Link>
      </div>
    </form>
  );
}
