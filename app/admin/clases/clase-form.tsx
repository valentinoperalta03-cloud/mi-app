"use client";

import { useActionState, useEffect, useState } from "react";
import { adminCTAPrimary } from "@/components/admin/admin-premium";
import {
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
  onSuccess,
}: {
  clubId: string;
  courts: Court[];
  coaches: Coach[];
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createPracticeAction,
    initial,
  );
  const [recurrence, setRecurrence] = useState<"once" | "weekly">("once");

  useEffect(() => {
    if (state.ok) onSuccess?.();
  }, [state.ok, onSuccess]);

  return (
    <form action={formAction} className="mt-4 space-y-4 text-sm">
      <input type="hidden" name="club_id" value={clubId} />
      {state.message && !state.ok ? (
        <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {state.message}
        </p>
      ) : null}

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Título
        </span>
        <input
          name="title"
          required
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Tipo de fecha
        </span>
        <select
          name="recurrence_type"
          required
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as "once" | "weekly")}
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
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
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            {recurrence === "once" ? "Fecha" : "Desde"}
          </span>
          <input
            type="date"
            name="start_date"
            required
            className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
          />
        </label>
        {recurrence === "weekly" ? (
          <label className="block">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Hasta
            </span>
            <input
              type="date"
              name="end_date"
              required
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
            />
          </label>
        ) : (
          <input type="hidden" name="end_date" value="" />
        )}
      </div>

      {recurrence === "weekly" ? (
        <fieldset>
          <legend className="text-xs font-semibold text-[var(--text-secondary)]">
            Días de la semana
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map((d) => (
              <label
                key={d.value}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium"
              >
                <input
                  type="checkbox"
                  name="weekly_days"
                  value={String(d.value)}
                  className="rounded"
                />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Hora
        </span>
        <input
          type="time"
          name="start_time"
          required
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Cupos
        </span>
        <input
          type="number"
          name="max_spots"
          min={1}
          max={20}
          defaultValue={4}
          required
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Precio base (ARS, lo que recibe el club)
        </span>
        <input
          type="number"
          name="price_base"
          min={0}
          step="100"
          defaultValue={0}
          required
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Profesor (opcional)
        </span>
        <select
          name="coach_id"
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
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
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Cancha (opcional)
        </span>
        <select
          name="court_id"
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
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
        className={`w-full text-center ${adminCTAPrimary} disabled:opacity-60`}
      >
        {pending ? "Publicando…" : "Publicar clase"}
      </button>
    </form>
  );
}
