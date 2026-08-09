"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { adminButtonSecondary, adminCTAPrimary } from "@/components/admin/admin-premium";
import { addCourtTimeRange, removeCourtTimeRange } from "./actions";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

export type CourtTimeRange = { id: string; day_of_week: number; open_time: string; close_time: string };

export default function CourtTimeRangesClient({
  courtId,
  clubOpen,
  clubClose,
  initialRanges,
}: {
  courtId: string;
  clubOpen: string;
  clubClose: string;
  initialRanges: CourtTimeRange[];
}) {
  const router = useRouter();
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [openInput, setOpenInput] = useState(clubOpen || "09:00");
  const [closeInput, setCloseInput] = useState(clubClose || "22:30");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function rangesForDay(day: number) {
    return initialRanges
      .filter((r) => r.day_of_week === day)
      .slice()
      .sort((a, b) => a.open_time.localeCompare(b.open_time));
  }

  function openAddForm(day: number) {
    setError(null);
    setOpenInput(clubOpen || "09:00");
    setCloseInput(clubClose || "22:30");
    setAddingDay(addingDay === day ? null : day);
  }

  function handleAdd(day: number) {
    setError(null);
    startTransition(async () => {
      const result = await addCourtTimeRange(courtId, day, openInput, closeInput);
      if (!result.ok) {
        setError(result.message ?? "No se pudo guardar la franja.");
        return;
      }
      setAddingDay(null);
      router.refresh();
    });
  }

  function handleRemove(rangeId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeCourtTimeRange(rangeId);
      if (!result.ok) {
        setError(result.message ?? "No se pudo eliminar la franja.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </p>
      ) : null}
      {DAY_ORDER.map((day) => {
        const dayRanges = rangesForDay(day);
        return (
          <div key={day} className="rounded-2xl border border-[var(--border-subtle)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{DAY_LABELS[day]}</p>
              <button
                type="button"
                disabled={pending}
                onClick={() => openAddForm(day)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0461C4] disabled:opacity-50 dark:text-sky-400"
              >
                <Plus size={14} />
                {dayRanges.length === 0 ? "Personalizar" : "Agregar franja"}
              </button>
            </div>

            {dayRanges.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                {clubOpen && clubClose ? `${clubOpen} - ${clubClose} (horario del club)` : "Sin horario configurado"}
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {dayRanges.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]"
                  >
                    {String(r.open_time).slice(0, 5)} - {String(r.close_time).slice(0, 5)}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleRemove(r.id)}
                      className="text-rose-600 disabled:opacity-50 dark:text-rose-400"
                      aria-label="Eliminar franja"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {addingDay === day ? (
              <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-[var(--bg-subtle)] p-2.5">
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-[var(--text-secondary)]">Apertura</span>
                  <input
                    type="time"
                    value={openInput}
                    onChange={(e) => setOpenInput(e.target.value)}
                    className="rounded-lg border border-[var(--border-subtle)] bg-transparent px-2 py-1.5 text-xs"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-[var(--text-secondary)]">Cierre</span>
                  <input
                    type="time"
                    value={closeInput}
                    onChange={(e) => setCloseInput(e.target.value)}
                    className="rounded-lg border border-[var(--border-subtle)] bg-transparent px-2 py-1.5 text-xs"
                  />
                </label>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleAdd(day)}
                  className={`${adminCTAPrimary} px-3 py-1.5 text-xs disabled:opacity-60`}
                >
                  {pending ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setAddingDay(null)}
                  className={`${adminButtonSecondary} px-3 py-1.5 text-xs`}
                >
                  Cancelar
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
