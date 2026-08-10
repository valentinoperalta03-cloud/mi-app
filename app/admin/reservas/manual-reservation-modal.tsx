"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { adminButtonSecondary } from "@/components/admin/admin-premium";
import {
  createManualReservationAction,
  searchPlayersAction,
  type ManualReservationState,
  type PlayerSearchResult,
} from "./actions";

const initial: ManualReservationState = { ok: false, message: "" };

const fieldClass =
  "w-full rounded-lg border border-[var(--border-subtle)] bg-transparent px-4 py-3 text-sm transition-colors " +
  "placeholder:text-[var(--text-tertiary)] focus:border-blue-500 focus:outline-none focus:ring-2 " +
  "focus:ring-blue-500/20 dark:focus:border-blue-400 dark:focus:ring-blue-400/20";

type FinancialStatus = "unpaid" | "partially_paid" | "fully_paid";
type PaymentMethod = "cash" | "transfer";

const FINANCIAL_OPTIONS: { value: FinancialStatus; label: string }[] = [
  { value: "unpaid", label: "Pendiente" },
  { value: "partially_paid", label: "Seña abonada" },
  { value: "fully_paid", label: "Pago completo" },
];

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-200 ${
        active
          ? "bg-[#0085FC] text-white"
          : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/70"
      }`}
    >
      {children}
    </button>
  );
}

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
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

  let dateLabel = date;
  try {
    const label = format(parseISO(`${date}T12:00:00`), "EEEE d MMM", { locale: es });
    dateLabel = label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    // dateLabel ya tiene el fallback (string crudo)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-reservation-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto" style={{ borderRadius: 16, background: "var(--bg-card)" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #0085FC, #0461C4)",
            borderRadius: "16px 16px 0 0",
            padding: "20px 24px",
          }}
        >
          <h2 id="manual-reservation-title" className="font-admin-display text-lg font-bold text-white">
            Nueva reserva
          </h2>
          <p className="mt-1 text-sm text-white/80">
            {courtName} · {dateLabel} · {time} hs
          </p>
        </div>

        <div style={{ padding: 24 }}>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="court_id" value={courtId} />
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="time" value={time} />
            <input type="hidden" name="financial_status" value={financialStatus} />
            {financialStatus !== "unpaid" ? <input type="hidden" name="payment_method" value={paymentMethod} /> : null}
            {selectedPlayers.map((p) => (
              <input key={p.id} type="hidden" name="player_ids" value={p.id} />
            ))}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Nombre o referencia</span>
              <input name="reference" required placeholder="Ej: Reserva de Marcos por teléfono" className={fieldClass} />
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
                    <ul className="mt-1.5 max-h-32 overflow-y-auto rounded-lg border border-[var(--border-subtle)]">
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

            <div>
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Estado de pago</span>
              <div className="grid grid-cols-3 gap-2">
                {FINANCIAL_OPTIONS.map((opt) => (
                  <Chip key={opt.value} active={financialStatus === opt.value} onClick={() => setFinancialStatus(opt.value)}>
                    {opt.label}
                  </Chip>
                ))}
              </div>
            </div>

            {financialStatus !== "unpaid" ? (
              <>
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Método de pago</span>
                  <div className="grid grid-cols-2 gap-2">
                    {METHOD_OPTIONS.map((opt) => (
                      <Chip key={opt.value} active={paymentMethod === opt.value} onClick={() => setPaymentMethod(opt.value)}>
                        {opt.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Monto</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">
                      $
                    </span>
                    <input type="number" name="amount" min={1} step="1" required className={`${fieldClass} pl-7`} />
                  </div>
                </label>
              </>
            ) : null}

            {state.message ? (
              <p
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
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
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(0,133,252,0.55)] transition-all duration-200 hover:brightness-105 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #0085FC, #0461C4)" }}
              >
                {pending ? "Creando…" : "Crear reserva"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
