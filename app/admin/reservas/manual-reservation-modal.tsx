"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { adminButtonSecondary, adminCTAPrimary, adminCard } from "@/components/admin/admin-premium";
import {
  createManualReservationAction,
  searchPlayersAction,
  type ManualReservationState,
  type PlayerSearchResult,
} from "./actions";

const initial: ManualReservationState = { ok: false, message: "" };

const fieldClass =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-transparent px-4 py-3 text-sm transition-colors " +
  "placeholder:text-[var(--text-tertiary)] focus:border-blue-500 focus:outline-none focus:ring-2 " +
  "focus:ring-blue-500/20 dark:focus:border-blue-400 dark:focus:ring-blue-400/20";

type FinancialStatus = "unpaid" | "partially_paid" | "fully_paid";

export default function ManualReservationModal({
  courtId,
  courtName,
  date,
  time,
  onClose,
}: {
  courtId: string;
  courtName: string;
  date: string;
  time: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createManualReservationAction, initial);
  const [financialStatus, setFinancialStatus] = useState<FinancialStatus>("unpaid");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerSearchResult[]>([]);
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      startSearch(async () => {
        const r = await searchPlayersAction(q);
        setResults(r.filter((p) => !selectedPlayers.some((sp) => sp.id === p.id)));
      });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function addPlayer(p: PlayerSearchResult) {
    if (selectedPlayers.length >= 4) return;
    setSelectedPlayers((prev) => [...prev, p]);
    setResults((prev) => prev.filter((r) => r.id !== p.id));
    setQuery("");
  }

  function removePlayer(id: string) {
    setSelectedPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-reservation-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`${adminCard} max-h-[90vh] w-full max-w-md overflow-y-auto`} style={{ borderRadius: 16 }}>
        <h2 id="manual-reservation-title" className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">
          Nueva reserva
        </h2>
        <p className="mt-1 text-sm font-medium text-[var(--text-tertiary)]">
          {courtName} · {date} · {time} hs
        </p>

        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="court_id" value={courtId} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="time" value={time} />
          {selectedPlayers.map((p) => (
            <input key={p.id} type="hidden" name="player_ids" value={p.id} />
          ))}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Nombre o referencia</span>
            <input name="reference" required placeholder='Ej: "Reserva de Marcos por teléfono"' className={fieldClass} />
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Buscar jugador en PadeLibre (opcional)
            </span>
            {selectedPlayers.length > 0 ? (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {selectedPlayers.map((p) => (
                  <li
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#0085FC]/10 px-2.5 py-1 text-xs font-semibold text-[#0461C4]"
                  >
                    {p.name}
                    <button
                      type="button"
                      onClick={() => removePlayer(p.id)}
                      className="text-[#0461C4]/70 hover:text-[#0461C4]"
                      aria-label={`Quitar ${p.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selectedPlayers.length < 4 ? (
              <>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Escribí un nombre…"
                  className={fieldClass}
                />
                {searching ? <p className="mt-1 text-xs text-[var(--text-tertiary)]">Buscando…</p> : null}
                {results.length > 0 ? (
                  <ul className="mt-1.5 max-h-32 overflow-y-auto rounded-xl border border-[var(--border-subtle)]">
                    {results.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => addPlayer(p)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-subtle)]"
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">Máximo 4 jugadores.</p>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Estado de pago</span>
            <select
              name="financial_status"
              value={financialStatus}
              onChange={(e) => setFinancialStatus(e.target.value as FinancialStatus)}
              className={fieldClass}
            >
              <option value="unpaid">Pendiente de pago</option>
              <option value="partially_paid">Seña abonada</option>
              <option value="fully_paid">Pago completo</option>
            </select>
          </label>

          {financialStatus !== "unpaid" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Método de pago</span>
                <select name="payment_method" className={fieldClass} defaultValue="cash">
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Monto</span>
                <input type="number" name="amount" min={1} step="1" required className={fieldClass} />
              </label>
            </div>
          ) : null}

          {state.message ? (
            <p
              className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                state.ok
                  ? "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200"
                  : "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-200"
              }`}
            >
              {state.message}
            </p>
          ) : null}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={`flex-1 ${adminButtonSecondary}`}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={`flex-1 ${adminCTAPrimary} disabled:opacity-60`}>
              {pending ? "Creando…" : "Crear reserva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
