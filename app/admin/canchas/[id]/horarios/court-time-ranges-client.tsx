"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Plus, X } from "lucide-react";
import { adminButtonSecondary, adminCTAPrimary, adminCard } from "@/components/admin/admin-premium";
import { addCourtTimeRange, applyTimeRangesToAllDays, removeCourtTimeRange } from "./actions";

const DAY_OPTIONS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];
const DAY_LABELS: Record<number, string> = {
  0: "domingo",
  1: "lunes",
  2: "martes",
  3: "miércoles",
  4: "jueves",
  5: "viernes",
  6: "sábado",
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
  const [activeDay, setActiveDay] = useState(1);
  const [adding, setAdding] = useState(false);
  const [openInput, setOpenInput] = useState(clubOpen || "09:00");
  const [closeInput, setCloseInput] = useState(clubClose || "22:30");
  const [error, setError] = useState<string | null>(null);
  const [confirmingApplyAll, setConfirmingApplyAll] = useState(false);
  const [pending, startTransition] = useTransition();

  const dayRanges = initialRanges
    .filter((r) => r.day_of_week === activeDay)
    .slice()
    .sort((a, b) => a.open_time.localeCompare(b.open_time));

  function openAddForm() {
    setError(null);
    setOpenInput(clubOpen || "09:00");
    setCloseInput(clubClose || "22:30");
    setAdding(true);
  }

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await addCourtTimeRange(courtId, activeDay, openInput, closeInput);
      if (!result.ok) {
        setError(result.message ?? "No se pudo guardar la franja.");
        return;
      }
      setAdding(false);
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

  function handleApplyToAllDays() {
    setError(null);
    startTransition(async () => {
      const result = await applyTimeRangesToAllDays(courtId, activeDay);
      if (!result.ok) {
        setError(result.message ?? "No se pudo aplicar a todos los días.");
        setConfirmingApplyAll(false);
        return;
      }
      setConfirmingApplyAll(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAY_OPTIONS.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => {
              setActiveDay(d.value);
              setAdding(false);
              setError(null);
            }}
            className={`flex min-h-11 shrink-0 cursor-pointer items-center rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-95 ${
              activeDay === d.value
                ? "bg-brand-gradient text-white shadow-[var(--admin-btn-shadow)] hover:brightness-105"
                : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[#0085FC]/40 hover:bg-[var(--bg-subtle)]"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {dayRanges.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-tertiary)]">
          {clubOpen && clubClose
            ? `Sin franjas propias — usando horario del club (${clubOpen} - ${clubClose})`
            : "Sin franjas propias y sin horario de club configurado."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {dayRanges.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-[#0461C4] dark:text-sky-300"
              style={{
                background: "rgba(0,133,252,0.08)",
                border: "1px solid rgba(0,133,252,0.20)",
                borderRadius: 10,
              }}
            >
              <span>
                {String(r.open_time).slice(0, 5)} → {String(r.close_time).slice(0, 5)}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleRemove(r.id)}
                className="cursor-pointer text-rose-600 transition-colors hover:text-rose-700 disabled:opacity-50 dark:text-rose-400 dark:hover:text-rose-300"
                aria-label="Eliminar franja"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className={`${adminCard} flex flex-wrap items-end gap-3`}>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-[var(--text-secondary)]">Hora inicio</span>
            <input
              type="time"
              value={openInput}
              onChange={(e) => setOpenInput(e.target.value)}
              className="rounded-lg border border-[var(--border-subtle)] bg-transparent px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-[var(--text-secondary)]">Hora fin</span>
            <input
              type="time"
              value={closeInput}
              onChange={(e) => setCloseInput(e.target.value)}
              className="rounded-lg border border-[var(--border-subtle)] bg-transparent px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={handleAdd}
            className={`${adminCTAPrimary} px-3 py-2 text-sm disabled:opacity-60`}
          >
            {pending ? "Guardando…" : "Guardar franja"}
          </button>
          <button type="button" onClick={() => setAdding(false)} className={`${adminButtonSecondary} px-3 py-2 text-sm`}>
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={dayRanges.length >= 4}
          onClick={openAddForm}
          className={`inline-flex cursor-pointer items-center gap-1.5 ${adminButtonSecondary} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <Plus size={16} />
          Agregar franja
        </button>
      )}

      {dayRanges.length > 0 ? (
        <button
          type="button"
          onClick={() => setConfirmingApplyAll(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#0085FC]/30 px-4 py-2.5 text-sm font-semibold text-[#0461C4] transition-colors duration-200 hover:bg-[#0085FC]/10 dark:text-sky-300"
        >
          <Copy size={16} />
          Aplicar a todos los días
        </button>
      ) : null}

      {confirmingApplyAll ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmingApplyAll(false);
          }}
        >
          <div className={`${adminCard} w-full max-w-sm`}>
            <p className="font-admin-display text-base font-semibold text-[var(--text-primary)]">
              ¿Aplicar franjas a todos los días?
            </p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Se van a copiar las franjas del {DAY_LABELS[activeDay]} a los demás días de la semana. Esto reemplaza las
              franjas que ya tengan cargadas.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingApplyAll(false)}
                className={`flex-1 ${adminButtonSecondary}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleApplyToAllDays}
                className={`flex-1 ${adminCTAPrimary} disabled:opacity-60`}
              >
                {pending ? "Aplicando…" : "Aplicar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
