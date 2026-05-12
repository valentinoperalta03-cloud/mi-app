"use client";

import { useActionState } from "react";
import { MAX_PAIRS_OPTIONS, TOURNAMENT_TYPE_OPTIONS } from "@/lib/tournament-constants";
import { eloBandMax, eloBandMin } from "@/lib/tournament-utils";
import { LEVEL_HIERARCHY } from "@/lib/match-level";
import { createTournamentAction, type CreateTournamentState } from "./actions";

const initial: CreateTournamentState = { ok: false, message: "" };

export default function TorneoForm({ clubId }: { clubId: string }) {
  const [state, formAction, pending] = useActionState(createTournamentAction, initial);

  return (
    <form action={formAction} className="mt-4 space-y-4 text-sm">
      <input type="hidden" name="club_id" value={clubId} />
      {state.message && !state.ok ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {state.message}
        </p>
      ) : null}

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Nombre</span>
        <input
          name="name"
          required
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tipo</span>
        <select
          name="tournament_type"
          required
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          {TOURNAMENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Descripción (opcional)</span>
        <textarea
          name="description"
          rows={2}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Inicio (fecha)</span>
          <input type="date" name="start_date" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Fin (fecha)</span>
          <input type="date" name="end_date" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Hora de inicio</span>
        <input type="time" name="start_time" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cierre de inscripción</span>
        <input
          type="datetime-local"
          name="registration_deadline"
          required
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Máx. parejas</span>
        <select name="max_pairs" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
          {MAX_PAIRS_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Precio por pareja (ARS, para el club)</span>
        <input
          type="number"
          name="price_per_pair"
          min={0}
          step="100"
          defaultValue={0}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Premio (opcional)</span>
        <input
          name="prize"
          placeholder="Recomendamos agregar un premio visible para los jugadores"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Categoría mínima (ELO)</span>
          <select name="category_min" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <option value="">Libre (sin piso)</option>
            {LEVEL_HIERARCHY.map((label, idx) => (
              <option key={label} value={eloBandMin(idx)}>
                {label.split("·")[0]?.trim()}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Categoría máxima (ELO)</span>
          <select name="category_max" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <option value="">Libre (sin techo)</option>
            {LEVEL_HIERARCHY.map((label, idx) => (
              <option key={`m-${label}`} value={eloBandMax(idx)}>
                {label.split("·")[0]?.trim()} (hasta {eloBandMax(idx)})
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Horas de cancelación</span>
        <select name="cancellation_hours" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
          <option value={24}>24</option>
          <option value={48}>48</option>
          <option value={72}>72</option>
        </select>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-[#0461C4] py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Crear torneo"}
      </button>
    </form>
  );
}
