"use client";

import { useActionState, useState } from "react";
import { adminCTAPrimary } from "@/components/admin/admin-premium";
import { MAX_PAIRS_OPTIONS, TOURNAMENT_TYPE_OPTIONS } from "@/lib/tournament-constants";
import { eloBandMax, eloBandMin } from "@/lib/tournament-utils";
import { LEVEL_HIERARCHY } from "@/lib/match-level";
import TournamentDepositFields from "@/components/admin/tournament-deposit-fields";
import { createTournamentAction, type CreateTournamentState } from "./actions";

const initial: CreateTournamentState = { ok: false, message: "" };

export default function TorneoForm({ clubId }: { clubId: string }) {
  const [state, formAction, pending] = useActionState(createTournamentAction, initial);
  const [clubPrice, setClubPrice] = useState(0);

  return (
    <form action={formAction} className="mt-4 space-y-4 text-sm">
      <input type="hidden" name="club_id" value={clubId} />
      {state.message && !state.ok ? (
        <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {state.message}
        </p>
      ) : null}

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Nombre</span>
        <input
          name="name"
          required
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Tipo</span>
        <select
          name="tournament_type"
          required
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        >
          {TOURNAMENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} disabled={o.value === "grupos_eliminacion"}>
              {o.value === "grupos_eliminacion" ? `${o.label} (Proximamente)` : o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Descripción (opcional)</span>
        <textarea
          name="description"
          rows={2}
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Inicio (fecha)</span>
          <input type="date" name="start_date" required className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Fin (fecha)</span>
          <input type="date" name="end_date" required className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]" />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Hora de inicio</span>
        <input type="time" name="start_time" required className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]" />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Cierre de inscripción</span>
        <input
          type="datetime-local"
          name="registration_deadline"
          required
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Máx. parejas</span>
        <select name="max_pairs" className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]">
          {MAX_PAIRS_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <div className="block">
        <label htmlFor="price_per_pair" className="text-xs font-semibold text-[var(--text-secondary)]">
          Precio por pareja (ARS, para el club)
        </label>
        <input
          id="price_per_pair"
          type="number"
          name="price_per_pair"
          min={0}
          step="100"
          defaultValue={0}
          onChange={(e) => setClubPrice(Number(e.target.value) || 0)}
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
        <p className="mt-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Los jugadores verán{" "}
          <span className="font-bold">${clubPrice.toLocaleString("es-AR")} por pareja</span>. Ese monto va
          entero a tu cuenta de Mercado Pago.
        </p>
      </div>

      <TournamentDepositFields pricePerPair={clubPrice} />

      <label className="block">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Premio (opcional)</span>
        <input
          name="prize"
          placeholder="Recomendamos agregar un premio visible para los jugadores"
          className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Categoría mínima (ELO)</span>
          <select name="category_min" className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]">
            <option value="">Libre (sin piso)</option>
            {LEVEL_HIERARCHY.map((label, idx) => (
              <option key={label} value={eloBandMin(idx)}>
                {label.split("·")[0]?.trim()}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Categoría máxima (ELO)</span>
          <select name="category_max" className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]">
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
        <span className="text-xs font-semibold text-[var(--text-secondary)]">Horas de cancelación</span>
        <select name="cancellation_hours" className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-[var(--text-primary)]">
          <option value={24}>24</option>
          <option value={48}>48</option>
          <option value={72}>72</option>
        </select>
      </label>

      <button
        type="submit"
        disabled={pending}
        className={`w-full text-center ${adminCTAPrimary} disabled:opacity-50`}
      >
        {pending ? "Guardando…" : "Crear torneo"}
      </button>
    </form>
  );
}
