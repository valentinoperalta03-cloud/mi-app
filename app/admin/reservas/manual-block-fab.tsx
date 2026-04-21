"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createManualCourtBlockAction, type ManualBlockState } from "./actions";

const SLOT_TIMES = [
  "07:30",
  "09:00",
  "10:30",
  "12:00",
  "13:30",
  "15:00",
  "16:30",
  "18:00",
  "19:30",
  "21:00",
  "22:30",
] as const;

const initial: ManualBlockState = { success: false, message: "" };

type CourtOption = { id: string; name: string };

function ManualBlockDialog({
  courts,
  onClose,
}: {
  courts: CourtOption[];
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
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
        <h2 id="block-title" className="text-lg font-semibold text-slate-900">
          Bloqueo manual
        </h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Inserta un registro en <code className="text-xs">court_blocks</code>.
        </p>

        <form action={formAction} className="mt-4 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Cancha</span>
            <select
              name="court_id"
              required
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
            >
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Fecha</span>
            <input
              name="date"
              type="date"
              required
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Hora inicio</span>
            <select
              name="start_time"
              required
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
            >
              {SLOT_TIMES.map((t) => (
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
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {state.message}
            </p>
          ) : null}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Guardando..." : "Bloquear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ManualBlockFab({ courts }: { courts: CourtOption[] }) {
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
        className="fixed bottom-[5.75rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_8px_24px_-6px_rgba(15,23,42,0.45)] transition-all hover:scale-[1.05] hover:bg-slate-800 active:scale-[0.92] md:bottom-8"
        aria-label="Bloqueo manual"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {open ? (
        <ManualBlockDialog key={dialogKey} courts={courts} onClose={closeDialog} />
      ) : null}
    </>
  );
}
