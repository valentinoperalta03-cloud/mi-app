"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  recordMatchResultAction,
  type RecordMatchResultState,
} from "@/app/(player)/matches/[id]/actions";

const initial: RecordMatchResultState = { ok: false, message: "" };

function SubmitRow({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
    >
      {pending ? "Guardando…" : label}
    </button>
  );
}

export function MatchResultForm({
  matchId,
  teamALabel,
  teamBLabel,
  resultAffectsTechnicalLevel,
}: {
  matchId: string;
  teamALabel: string;
  teamBLabel: string;
  resultAffectsTechnicalLevel: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(recordMatchResultAction, initial);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [router, state.ok]);

  const submitLabel = resultAffectsTechnicalLevel
    ? "Guardar resultado (nivel competitivo)"
    : "Guardar resultado";

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]"
    >
      <input type="hidden" name="match_id" value={matchId} />
      <div>
        <h2 className="text-sm font-bold tracking-tight text-slate-900">Cargar resultado</h2>
        <p className="mt-1 text-xs text-slate-500">
          Equipo A y B siguen el orden de anotación (IDs ascendente). Sets o juegos ganados (0–30).
        </p>
        {resultAffectsTechnicalLevel ? (
          <p className="mt-2 text-xs font-medium text-sky-800">
            Partido competitivo: el resultado ajusta el nivel técnico (0,0–7,0) de los cuatro
            jugadores.
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Partido amistoso: el resultado no modifica el nivel técnico.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">{teamALabel}</span>
          <input
            name="team_a_score"
            type="number"
            min={0}
            max={30}
            required
            className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-sky-400"
            placeholder="0"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">{teamBLabel}</span>
          <input
            name="team_b_score"
            type="number"
            min={0}
            max={30}
            required
            className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-sky-400"
            placeholder="0"
          />
        </label>
      </div>
      <SubmitRow label={submitLabel} />
      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`text-center text-xs font-medium ${
            state.ok ? "text-emerald-700" : "text-rose-600"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
