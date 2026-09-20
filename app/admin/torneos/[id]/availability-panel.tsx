"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { adminButtonSecondary, adminCTAPrimary, adminKicker } from "@/components/admin/admin-premium";
import { getCourtAvailabilityForDate } from "@/lib/tournament-availability";
import { AvailabilityGrid } from "../availability-grid";
import { updateTournamentAvailabilityAction, type TournamentSlot } from "./actions";

type Availability = { slots: string[]; occupiedByCourtAndSlot: Record<string, Record<string, string>> };

/**
 * Disponibilidad deportiva del torneo (secciones 4.4/11): el pool de
 * canchas+día+franja que el club destinó al torneo. Se completa en el
 * wizard de creación (torneo-form.tsx) y se puede seguir ampliando acá
 * después — necesario para "zonas", donde recién se sabe cuánta cancha hace
 * falta cuando se cierran inscripciones y se arman las zonas, mucho después
 * de haber creado el torneo. Este pool es lo que consume la calculadora de
 * demanda y "Generar programación" (autoScheduleTournamentAction) — nunca
 * el horario general del club.
 */
export function TournamentAvailabilityPanel({
  tournamentId,
  clubId,
  courts,
  initialSlots,
  editable,
}: {
  tournamentId: string;
  clubId: string;
  courts: Array<{ id: string; name: string }>;
  initialSlots: TournamentSlot[];
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, Record<string, boolean>>>(() => {
    const acc: Record<string, Record<string, boolean>> = {};
    for (const s of initialSlots) {
      acc[s.date] = acc[s.date] ?? {};
      acc[s.date][`${s.courtId}:${s.time}`] = true;
    }
    return acc;
  });
  const [availabilityByDate, setAvailabilityByDate] = useState<Record<string, Availability>>({});
  const [loadingDates, setLoadingDates] = useState<Set<string>>(new Set());
  const [newDate, setNewDate] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const dates = Object.keys(slotsByDate).sort();
  const totalSlots = Object.values(slotsByDate).reduce((a, m) => a + Object.values(m).filter(Boolean).length, 0);

  async function loadAvailability(date: string) {
    if (!date || !courts.length) return;
    setLoadingDates((prev) => new Set(prev).add(date));
    const avail = await getCourtAvailabilityForDate(clubId, courts.map((c) => c.id), date);
    setAvailabilityByDate((prev) => ({ ...prev, [date]: avail }));
    setLoadingDates((prev) => {
      const next = new Set(prev);
      next.delete(date);
      return next;
    });
  }

  function addDate() {
    if (!newDate || slotsByDate[newDate]) return;
    setSlotsByDate((prev) => ({ ...prev, [newDate]: {} }));
    void loadAvailability(newDate);
    setNewDate("");
  }

  function removeDate(date: string) {
    setSlotsByDate((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
  }

  function toggleSlot(date: string, courtId: string, time: string) {
    const key = `${courtId}:${time}`;
    setSlotsByDate((prev) => ({
      ...prev,
      [date]: { ...(prev[date] ?? {}), [key]: !(prev[date]?.[key] ?? false) },
    }));
  }

  function save() {
    setMsg(null);
    const slots: TournamentSlot[] = Object.entries(slotsByDate).flatMap(([date, m]) =>
      Object.entries(m)
        .filter(([, on]) => on)
        .map(([key]) => {
          const [courtId, time] = key.split(":");
          return { date, courtId, time };
        }),
    );
    start(async () => {
      const res = await updateTournamentAvailabilityAction(tournamentId, slots);
      setMsg(res.message);
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <div>
          <p className={adminKicker}>Disponibilidad del torneo</p>
          <p className="text-sm text-[var(--text-primary)]">
            {totalSlots} franja{totalSlots === 1 ? "" : "s"} en {dates.length} día{dates.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="text-sm text-[var(--text-tertiary)]">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="mt-3 space-y-4">
          {!editable ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">El torneo ya no admite cambios de disponibilidad.</p>
          ) : null}
          {dates.map((date) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold capitalize text-[var(--text-primary)]">
                  {format(parseISO(date), "EEEE d 'de' MMMM", { locale: es })}
                </p>
                {editable ? (
                  <button type="button" onClick={() => removeDate(date)} className="text-xs font-bold text-rose-500">
                    ✕ Quitar día
                  </button>
                ) : null}
              </div>
              {loadingDates.has(date) ? (
                <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0085FC] border-t-transparent" />
                  Cargando disponibilidad...
                </div>
              ) : availabilityByDate[date] ? (
                editable ? (
                  <AvailabilityGrid
                    courts={courts}
                    slots={availabilityByDate[date].slots}
                    occupiedByCourtAndSlot={availabilityByDate[date].occupiedByCourtAndSlot}
                    multiSelect
                    selectedSlots={slotsByDate[date] ?? {}}
                    onToggle={(courtId, time) => toggleSlot(date, courtId, time)}
                  />
                ) : (
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {Object.values(slotsByDate[date] ?? {}).filter(Boolean).length} franjas seleccionadas.
                  </p>
                )
              ) : (
                <button type="button" onClick={() => void loadAvailability(date)} className={`${adminButtonSecondary} text-xs`}>
                  Cargar horarios
                </button>
              )}
            </div>
          ))}

          {editable ? (
            <div className="flex items-end gap-2">
              <label className="block flex-1">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Agregar día</span>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </label>
              <button type="button" onClick={addDate} className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm font-semibold text-[#0085FC]">
                + Agregar
              </button>
            </div>
          ) : null}

          {editable ? (
            <button type="button" disabled={pending} onClick={save} className={`${adminCTAPrimary} disabled:opacity-50`}>
              {pending ? "Guardando…" : "Guardar disponibilidad"}
            </button>
          ) : null}
          {msg ? <p className="text-xs text-[var(--text-secondary)]">{msg}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
