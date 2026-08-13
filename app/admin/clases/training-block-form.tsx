"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { adminInputClass } from "@/components/admin/admin-form-input";
import { adminButtonGhost, adminButtonOutlineBrand, adminCTAPrimary } from "@/components/admin/admin-premium";
import { createTrainingBlockAction, type TrainingBlockState } from "./actions";

const initial: TrainingBlockState = { ok: false, message: "" };

const DAY_OPTIONS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

type Court = { id: string; name: string };

const fieldClass = adminInputClass;

function TrainingBlockDialog({ courts, onClose }: { courts: Court[]; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createTrainingBlockAction, initial);
  const [recurrence, setRecurrence] = useState<"recurring" | "once">("recurring");

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 backdrop-blur-sm"
        style={{ background: "rgba(0,0,0,0.60)" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl"
        style={{
          zIndex: 51,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(480px, 90vw)",
          background: "var(--bg-card)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-block-title"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="training-block-title" className="font-admin-display text-lg font-bold text-[var(--text-primary)]">
            Registrar entrenamiento externo
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 cursor-pointer rounded-lg p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm font-medium text-[var(--text-tertiary)]">
          Solo bloquea la cancha para tu registro interno. Los jugadores de PadeLibre no lo ven.
        </p>

        <form action={formAction} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Título</span>
            <input name="title" required className={fieldClass} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Cancha</span>
            <select name="court_id" required className={fieldClass}>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-[var(--text-secondary)]">Tipo</legend>
            <div className="flex gap-2">
              {(["recurring", "once"] as const).map((opt) => (
                <label
                  key={opt}
                  className={`flex-1 cursor-pointer rounded-xl border px-3 py-2 text-center text-sm font-semibold transition-colors ${
                    recurrence === opt
                      ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                      : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="recurrence"
                    value={opt}
                    checked={recurrence === opt}
                    onChange={() => setRecurrence(opt)}
                    className="sr-only"
                  />
                  {opt === "recurring" ? "Recurrente" : "Fecha puntual"}
                </label>
              ))}
            </div>
          </fieldset>

          {recurrence === "recurring" ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Día de la semana</span>
              <select name="day_of_week" required className={fieldClass}>
                {DAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Fecha</span>
              <input type="date" name="date" required className={fieldClass} />
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Hora inicio</span>
              <input type="time" name="start_time" required className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Hora fin</span>
              <input type="time" name="end_time" required className={fieldClass} />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Profesor (opcional)</span>
            <input name="coach" className={fieldClass} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Modalidad (opcional)</span>
            <input name="modality" placeholder="Ej: grupal, individual…" className={fieldClass} />
          </label>

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
            <button type="button" onClick={onClose} className={`flex-1 ${adminButtonGhost}`}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={`flex-1 ${adminCTAPrimary} disabled:opacity-60`}>
              {pending ? "Guardando…" : "Guardar entrenamiento"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default function TrainingBlockForm({ courts }: { courts: Court[] }) {
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  if (courts.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDialogKey((k) => k + 1);
          setOpen(true);
        }}
        className={`inline-flex shrink-0 items-center gap-1.5 ${adminButtonOutlineBrand}`}
      >
        <Plus size={16} />
        Registrar entrenamiento externo
      </button>

      {open ? <TrainingBlockDialog key={dialogKey} courts={courts} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
