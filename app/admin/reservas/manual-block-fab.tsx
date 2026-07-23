"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { adminButtonSecondary, adminCard, adminCTAPrimary } from "@/components/admin/admin-premium";
import { createManualCourtBlockAction, type ManualBlockState } from "./actions";

const initial: ManualBlockState = { success: false, message: "" };

type CourtOption = { id: string; name: string };

function ManualBlockDialog({
  courts,
  slotTimes,
  onClose,
}: {
  courts: CourtOption[];
  slotTimes: string[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createManualCourtBlockAction, initial);

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`${adminCard} w-full max-w-md`}>
        <h2 id="block-title" className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">
          Bloqueo manual
        </h2>
        <p className="mt-1 text-sm font-medium text-[var(--text-tertiary)]">
          Bloqueá una cancha en un horario puntual para que no quede disponible para reservar.
        </p>

        <form action={formAction} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Cancha</span>
            <select
              name="court_id"
              required
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-transparent px-4 py-3 text-sm transition-colors placeholder:text-[var(--text-tertiary)] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            >
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Fecha</span>
            <input
              name="date"
              type="date"
              required
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-transparent px-4 py-3 text-sm transition-colors placeholder:text-[var(--text-tertiary)] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Hora inicio</span>
            <select
              name="start_time"
              required
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-transparent px-4 py-3 text-sm transition-colors placeholder:text-[var(--text-tertiary)] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            >
              {slotTimes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          {state.message ? (
            <p
              className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                state.success
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
              {pending ? "Guardando..." : "Bloquear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ManualBlockFab({ courts, slotTimes }: { courts: CourtOption[]; slotTimes: string[] }) {
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const closeDialog = useCallback(() => setOpen(false), []);

  if (courts.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDialogKey((k) => k + 1);
          setOpen(true);
        }}
        className="fixed bottom-[5.75rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-[0_8px_24px_-6px_rgba(15,23,42,0.45)] transition-all hover:scale-[1.05] hover:brightness-105 active:scale-[0.92] md:bottom-8"
        aria-label="Bloqueo manual"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {open ? (
        <ManualBlockDialog key={dialogKey} courts={courts} slotTimes={slotTimes} onClose={closeDialog} />
      ) : null}
    </>
  );
}
