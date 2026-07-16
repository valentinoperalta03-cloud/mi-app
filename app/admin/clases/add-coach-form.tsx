"use client";

import { useActionState } from "react";
import { adminCard, adminCTAPrimary } from "@/components/admin/admin-premium";
import { createPracticeCoachAction, type CoachState } from "./actions";

const initial: CoachState = { ok: false, message: "" };

export default function AddCoachForm({ clubId }: { clubId: string }) {
  const [state, formAction, pending] = useActionState(createPracticeCoachAction, initial);

  return (
    <form action={formAction} className={`mt-4 flex flex-wrap items-end gap-2 ${adminCard}`}>
      <input type="hidden" name="club_id" value={clubId} />
      <label className="min-w-0 flex-1">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Agregar profesor</span>
        <input
          name="name"
          placeholder="Nombre"
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className={`${adminCTAPrimary} px-3 py-2 text-xs`}
      >
        {pending ? "…" : "Agregar"}
      </button>
      {state.message ? (
        <p className={`w-full text-xs ${state.ok ? "text-emerald-600" : "text-rose-600"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
