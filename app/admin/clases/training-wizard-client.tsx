"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { adminButtonGhost, adminButtonOutlineBrand, adminCTAPrimary, adminKicker } from "@/components/admin/admin-premium";
import { adminInputClass } from "@/components/admin/admin-form-input";
import {
  buildSlotsForDay,
  minutesToClock,
  parseClockToMinutes,
  type CourtTimeRangeInput,
} from "@/lib/court-slots";
import { createTrainingBlockAction } from "./actions";

type Court = { id: string; name: string };

// Días en orden de exhibición (lunes primero); value coincide con day_of_week (0=domingo).
const DAY_COLUMNS = [
  { value: 1, short: "LUN", full: "Lunes" },
  { value: 2, short: "MAR", full: "Martes" },
  { value: 3, short: "MIÉ", full: "Miércoles" },
  { value: 4, short: "JUE", full: "Jueves" },
  { value: 5, short: "VIE", full: "Viernes" },
  { value: 6, short: "SÁB", full: "Sábado" },
  { value: 0, short: "DOM", full: "Domingo" },
];

const GRID_SLOT_MINUTES = 30;

/** 2023-01-01 fue domingo — sirve como ancla para pedirle a buildSlotsForDay el día de semana que necesitamos. */
function referenceDateForDow(dayOfWeek: number): Date {
  return new Date(2023, 0, 1 + dayOfWeek);
}

function cellKey(day: number, time: string) {
  return `${day}__${time}`;
}

function TrainingWizardDialog({
  courts,
  timeRanges,
  clubOpen,
  clubClose,
  onClose,
}: {
  courts: Court[];
  timeRanges: CourtTimeRangeInput[];
  clubOpen: string;
  clubClose: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [coachName, setCoachName] = useState("");
  const [modality, setModality] = useState("");
  const [courtId, setCourtId] = useState(courts[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const clubBounds = useMemo(
    () => ({ open_time: clubOpen || null, close_time: clubClose || null }),
    [clubOpen, clubClose]
  );

  const timesByDay = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (const day of DAY_COLUMNS) {
      const slots = buildSlotsForDay(
        [courtId],
        referenceDateForDow(day.value),
        timeRanges,
        clubBounds,
        GRID_SLOT_MINUTES
      );
      map.set(day.value, new Set(slots.map((s) => s.time)));
    }
    return map;
  }, [courtId, timeRanges, clubBounds]);

  const rowTimes = useMemo(() => {
    const all = new Set<string>();
    for (const set of timesByDay.values()) {
      for (const t of set) all.add(t);
    }
    return Array.from(all).sort((a, b) => parseClockToMinutes(a) - parseClockToMinutes(b));
  }, [timesByDay]);

  function toggleCell(day: number, time: string) {
    const key = cellKey(day, time);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleCourtChange(nextCourtId: string) {
    setCourtId(nextCourtId);
    setSelected(new Set());
  }

  function handleSave() {
    if (selected.size === 0) return;
    setError(null);
    startTransition(async () => {
      const entries = Array.from(selected).map((key) => {
        const [dayStr, time] = key.split("__");
        return { day: Number(dayStr), time };
      });

      let failed = 0;
      for (const entry of entries) {
        const fd = new FormData();
        fd.set("court_id", courtId);
        fd.set("title", coachName.trim());
        fd.set("coach", coachName.trim());
        fd.set("modality", modality.trim());
        fd.set("recurrence", "recurring");
        fd.set("day_of_week", String(entry.day));
        fd.set("start_time", entry.time);
        fd.set("end_time", minutesToClock(parseClockToMinutes(entry.time) + GRID_SLOT_MINUTES));
        const res = await createTrainingBlockAction({ ok: false, message: "" }, fd);
        if (!res.ok) failed++;
      }

      if (failed > 0) {
        setError(`No se pudieron guardar ${failed} de ${entries.length} horarios.`);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg-app)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="training-wizard-title"
    >
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="training-wizard-title" className="font-admin-display text-lg font-bold text-[var(--text-primary)]">
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

        {step === 1 ? (
          <div className="mt-4 space-y-4">
            <p className={adminKicker}>Paso 1 de 2 · Profesor</p>
            <p className="text-sm font-medium text-[var(--text-secondary)]">¿Quién va a dar el entrenamiento?</p>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Nombre del profesor</span>
              <input
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
                placeholder="Nombre del profesor"
                className={adminInputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Modalidad (opcional)</span>
              <input
                value={modality}
                onChange={(e) => setModality(e.target.value)}
                placeholder='Ej: "Clases particulares"'
                className={adminInputClass}
              />
            </label>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!coachName.trim() || courts.length === 0}
                onClick={() => setStep(2)}
                className={`${adminCTAPrimary} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                Continuar →
              </button>
            </div>
            {courts.length === 0 ? (
              <p className="text-xs text-[var(--text-tertiary)]">Necesitás al menos una cancha cargada.</p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className={adminKicker}>Paso 2 de 2 · Horarios</p>
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Tocá los horarios en los que <span className="font-bold">{coachName}</span> va a usar la cancha.
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">Podés seleccionar múltiples días y horas.</p>

            {rowTimes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
                No hay horarios disponibles para esta cancha. Revisá sus franjas horarias u horario del club.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[var(--admin-card-border)]">
                <div className="min-w-[560px]">
                  <div
                    className="grid"
                    style={{ gridTemplateColumns: `64px repeat(${DAY_COLUMNS.length}, minmax(64px, 1fr))` }}
                  >
                    <div className="sticky left-0 z-10 border-b border-r border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-2" />
                    {DAY_COLUMNS.map((d) => (
                      <div
                        key={d.value}
                        className="border-b border-r border-white/15 px-2 py-2 text-center text-xs font-semibold text-white last:border-r-0"
                        style={{ background: "var(--admin-brand-gradient)" }}
                      >
                        {d.short}
                      </div>
                    ))}
                  </div>

                  {rowTimes.map((time) => (
                    <div
                      key={time}
                      className="grid"
                      style={{ gridTemplateColumns: `64px repeat(${DAY_COLUMNS.length}, minmax(64px, 1fr))` }}
                    >
                      <div className="sticky left-0 z-10 flex items-center justify-end border-b border-r border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
                        {time}
                      </div>
                      {DAY_COLUMNS.map((d) => {
                        const available = timesByDay.get(d.value)?.has(time) ?? false;
                        const key = cellKey(d.value, time);
                        const isSelected = selected.has(key);
                        return (
                          <div key={key} className="border-b border-r border-[var(--border-subtle)] p-1 last:border-r-0">
                            {available ? (
                              <button
                                type="button"
                                onClick={() => toggleCell(d.value, time)}
                                aria-pressed={isSelected}
                                className={`flex h-8 w-full items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                                  isSelected
                                    ? "bg-[#CCFF00] text-[#0A1628]"
                                    : "bg-[var(--bg-subtle)] hover:bg-[var(--bg-card)]"
                                }`}
                              >
                                {isSelected ? "✓" : ""}
                              </button>
                            ) : (
                              <div className="h-8 w-full rounded-lg opacity-20" style={{ background: "var(--bg-subtle)" }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="block max-w-xs">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Cancha</span>
              <select
                value={courtId}
                onChange={(e) => handleCourtChange(e.target.value)}
                className={adminInputClass}
              >
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <p className="text-xs text-[var(--text-tertiary)]">
              {selected.size} horario{selected.size === 1 ? "" : "s"} seleccionado{selected.size === 1 ? "" : "s"}.
            </p>

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setStep(1)} className={`flex-1 ${adminButtonGhost}`}>
                ← Volver
              </button>
              <button
                type="button"
                disabled={selected.size === 0 || pending}
                onClick={handleSave}
                className={`flex-1 ${adminCTAPrimary} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {pending ? "Guardando…" : "Guardar entrenamiento"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrainingWizard({
  courts,
  timeRanges,
  clubOpen,
  clubClose,
}: {
  courts: Court[];
  timeRanges: CourtTimeRangeInput[];
  clubOpen: string;
  clubClose: string;
}) {
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

      {open ? (
        <TrainingWizardDialog
          key={dialogKey}
          courts={courts}
          timeRanges={timeRanges}
          clubOpen={clubOpen}
          clubClose={clubClose}
          onClose={() => {
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
