"use client";

import { useActionState, useState } from "react";
import {
  PRACTICE_MODALITY_OPTIONS,
  PRACTICE_RECURRENCE_OPTIONS,
  WEEKDAY_OPTIONS,
} from "@/lib/practice-constants";
import { createPracticeAction, type CreatePracticeState } from "./actions";

const initial: CreatePracticeState = { ok: false, message: "" };

type Court = { id: string; name: string };
type Coach = { id: string; name: string };

export default function ClaseForm({
  clubId,
  courts,
  coaches,
}: {
  clubId: string;
  courts: Court[];
  coaches: Coach[];
}) {
  const [state, formAction, pending] = useActionState(createPracticeAction, initial);
  const [recurrence, setRecurrence] = useState<"once" | "weekly">("once");

  return (
    <form action={formAction} className="mt-4 space-y-4 text-sm">
      <input type="hidden" name="club_id" value={clubId} />
      {state.message && !state.ok ? (
        <p className="rounded-xl border border-rose-200 bg-rose-100/60 px-3 py-2 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {state.message}
        </p>
      ) : null}

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Título</span>
        <input
          name="title"
          required
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Descripción (opcional)</span>
        <textarea
          name="description"
          rows={2}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tipo de fecha</span>
        <select
          name="recurrence_type"
          required
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as "once" | "weekly")}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          {PRACTICE_RECURRENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {recurrence === "once" ? "Fecha" : "Desde"}
          </span>
          <input
            type="date"
            name="start_date"
            required
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>
        {recurrence === "weekly" ? (
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Hasta</span>
            <input
              type="date"
              name="end_date"
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
        ) : (
          <input type="hidden" name="end_date" value="" />
        )}
      </div>

      {recurrence === "weekly" ? (
        <fieldset>
          <legend className="text-xs font-semibold text-slate-600 dark:text-slate-300">Días de la semana</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map((d) => (
              <label
                key={d.value}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium dark:border-slate-700"
              >
                <input type="checkbox" name="weekly_days" value={String(d.value)} className="rounded" />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Hora</span>
        <input
          type="time"
          name="start_time"
          required
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Modalidad</span>
          <select
            name="modality"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {PRACTICE_MODALITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cupos</span>
          <input
            type="number"
            name="max_spots"
            min={1}
            max={20}
            defaultValue={4}
            required
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Precio base (ARS, lo que recibe el club)</span>
        <input
          type="number"
          name="price_base"
          min={0}
          step="100"
          defaultValue={0}
          required
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Profesor (opcional)</span>
        <select
          name="coach_id"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="">Sin profesor</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cancha (opcional)</span>
        <select
          name="court_id"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="">Sin asignar</option>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-[#0461C4] py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Crear borrador"}
      </button>
      <p className="text-center text-xs text-slate-500">Después publicá la clase para que los jugadores la vean.</p>
    </form>
  );
}
