"use client";

import { useActionState } from "react";
import { createPracticeCoachAction, type CoachState } from "./actions";

const initial: CoachState = { ok: false, message: "" };

export default function AddCoachForm({ clubId }: { clubId: string }) {
  const [state, formAction, pending] = useActionState(createPracticeCoachAction, initial);

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
      <input type="hidden" name="club_id" value={clubId} />
      <label className="min-w-0 flex-1">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Agregar profesor</span>
        <input
          name="name"
          placeholder="Nombre"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white dark:bg-slate-700"
      >
        {pending ? "…" : "Agregar"}
      </button>
      {state.message ? (
        <p className={`w-full text-xs ${state.ok ? "text-emerald-600" : "text-rose-600"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
