"use client";

import { useActionState, useEffect, useState } from "react";
import { adminCard, adminCTAPrimary } from "@/components/admin/admin-premium";
import { MAX_PAIRS_OPTIONS } from "@/lib/tournament-constants";
import { createTournamentAction, type CreateTournamentState } from "./actions";

const initial: CreateTournamentState = { ok: false, message: "" };

export default function TorneoFormInline({
  clubId,
  onSuccess,
}: {
  clubId: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createTournamentAction,
    initial,
  );
  const [startDate, setStartDate] = useState("");

  useEffect(() => {
    if (state.ok) onSuccess?.();
  }, [state.ok, onSuccess]);

  return (
    <form action={formAction} className={`${adminCard} space-y-4 text-sm`}>
      <input type="hidden" name="club_id" value={clubId} />
      {/* Torneo simplificado: siempre "americano", torneo de un solo día. Para
          eliminación/peña o fechas personalizadas, usar el detalle del torneo. */}
      <input type="hidden" name="tournament_type" value="americano" />
      <input type="hidden" name="start_time" value="09:00" />
      <input type="hidden" name="end_date" value={startDate} />
      <input
        type="hidden"
        name="registration_deadline"
        value={startDate ? `${startDate}T00:00` : ""}
      />

      {state.message && !state.ok ? (
        <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {state.message}
        </p>
      ) : null}

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Nombre del torneo
        </span>
        <input
          name="name"
          required
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Fecha de inicio
        </span>
        <input
          type="date"
          name="start_date"
          required
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Precio de inscripción (ARS, por pareja)
        </span>
        <input
          type="number"
          name="price_per_pair"
          min={0}
          step="100"
          defaultValue={0}
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Máximo de parejas
        </span>
        <select
          name="max_pairs"
          defaultValue={16}
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        >
          {MAX_PAIRS_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={pending || !startDate}
        className={`w-full text-center ${adminCTAPrimary} disabled:opacity-50`}
      >
        {pending ? "Creando…" : "Crear torneo"}
      </button>
    </form>
  );
}
