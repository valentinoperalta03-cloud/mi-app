"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { adminButtonSecondary, adminCTAPrimary, adminCard } from "@/components/admin/admin-premium";
import { minutesToClock, parseClockToMinutes, parseCloseTimeToMinutes } from "@/lib/court-slots";
import { applyCourtPricesToAllDays, saveCourtHourlyPrices } from "../precios/actions";
import type { CourtTimeRange } from "./court-time-ranges-client";

const SLOT_DURATION = 90;

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

export type CourtPriceRow = { dayOfWeek: number | null; startTime: string; price: number };

/** Mismo criterio que buildSlotsForDay: franjas propias del día, o el horario global del club como fallback. */
function buildTurnsForDay(
  timeRanges: CourtTimeRange[],
  dayOfWeek: number,
  clubOpen: string
): { start: string; end: string }[] {
  const dayRanges = timeRanges.filter((r) => r.day_of_week === dayOfWeek);

  if (dayRanges.length === 0) {
    if (!clubOpen) return [];
    const rawOpen = parseClockToMinutes(clubOpen);
    const turns: { start: string; end: string }[] = [];
    for (let t = rawOpen; t < 24 * 60; t += SLOT_DURATION) {
      turns.push({ start: minutesToClock(t), end: minutesToClock(t + SLOT_DURATION) });
    }
    return turns;
  }

  const seen = new Set<string>();
  const turns: { start: string; end: string }[] = [];
  for (const r of dayRanges) {
    const openMin = parseClockToMinutes(String(r.open_time).slice(0, 5));
    const closeMin = parseCloseTimeToMinutes(String(r.close_time).slice(0, 5));
    for (let t = openMin; t + SLOT_DURATION <= closeMin; t += SLOT_DURATION) {
      const start = minutesToClock(t);
      if (seen.has(start)) continue;
      seen.add(start);
      turns.push({ start, end: minutesToClock(t + SLOT_DURATION) });
    }
  }
  return turns.sort((a, b) => parseClockToMinutes(a.start) - parseClockToMinutes(b.start));
}

export default function CourtPricesClient({
  courtId,
  clubOpen,
  basePrice,
  timeRanges,
  priceRows,
}: {
  courtId: string;
  clubOpen: string;
  basePrice: number;
  timeRanges: CourtTimeRange[];
  priceRows: CourtPriceRow[];
}) {
  const router = useRouter();
  const [activeDay, setActiveDay] = useState(1);
  const [confirmingApplyAll, setConfirmingApplyAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const turns = buildTurnsForDay(timeRanges, activeDay, clubOpen);

  // Precio específico del día si existe; si no, el legacy day_of_week IS NULL
  // (fallback para días que nunca se guardaron explícitamente); si no, el
  // precio base de la cancha.
  function priceForStart(start: string): number {
    const specific = priceRows.find((r) => r.dayOfWeek === activeDay && r.startTime === start);
    if (specific) return specific.price;
    const fallback = priceRows.find((r) => r.dayOfWeek === null && r.startTime === start);
    if (fallback) return fallback.price;
    return basePrice;
  }

  const hasSavedPricesForDay = priceRows.some((r) => r.dayOfWeek === activeDay);

  function handleApplyToAllDays() {
    setError(null);
    startTransition(async () => {
      const result = await applyCourtPricesToAllDays(courtId, activeDay);
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
              setError(null);
              setConfirmingApplyAll(false);
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

      {turns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-tertiary)]">
          No hay turnos disponibles para este día. Revisá la configuración de franjas horarias u horario del club.
        </p>
      ) : (
        // key=activeDay: fuerza remount al cambiar de día — los inputs de precio
        // son no controlados (defaultValue), sin esto no se actualizarían al
        // cambiar de tab.
        <form key={activeDay} action={saveCourtHourlyPrices} className="space-y-4">
          <input type="hidden" name="court_id" value={courtId} />
          <input type="hidden" name="day_of_week" value={activeDay} />
          <input type="hidden" name="slot_duration_minutes" value={SLOT_DURATION} />
          {turns.map((turn) => (
            <label
              key={`${turn.start}-${turn.end}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/70 px-4 py-3"
            >
              <span className="text-sm font-semibold text-[var(--text-secondary)]">
                {turn.start} - {turn.end}
              </span>
              <input
                type="number"
                min={0}
                step="1"
                name={`price_${turn.start}`}
                defaultValue={priceForStart(turn.start)}
                className="w-36 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-right text-sm font-medium text-[var(--text-secondary)] outline-none focus:border-[#0085FC]/30 focus:ring-2 focus:ring-[#0085FC]/20"
              />
            </label>
          ))}
          <button type="submit" className={`w-full ${adminCTAPrimary}`}>
            Guardar precios de {DAY_LABELS[activeDay]}
          </button>
        </form>
      )}

      {hasSavedPricesForDay ? (
        <button
          type="button"
          onClick={() => setConfirmingApplyAll(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#0085FC]/30 px-4 py-2.5 text-sm font-semibold text-[#0461C4] transition-colors duration-200 hover:bg-[#0085FC]/10 dark:text-sky-300"
        >
          <Copy size={16} />
          Aplicar precios a todos los días
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
              ¿Aplicar precios a todos los días?
            </p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Se van a copiar los precios del {DAY_LABELS[activeDay]} a los demás días de la semana. Esto reemplaza
              los precios que ya tengan cargados para esos días.
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
