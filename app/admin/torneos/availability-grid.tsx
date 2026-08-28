"use client";

import { useState } from "react";

export type AvailabilityCourt = { id: string; name: string };

type CommonProps = {
  courts: AvailabilityCourt[];
  slots: string[];
  occupiedByCourtAndSlot: Record<string, Record<string, string>>;
};

type SingleSelectProps = CommonProps & {
  multiSelect?: false;
  selectedCourtId: string | null;
  selectedTime: string | null;
  onSelect: (courtId: string, time: string) => void;
};

type MultiSelectProps = CommonProps & {
  multiSelect: true;
  selectedSlots: Record<string, boolean>;
  onToggle: (courtId: string, time: string) => void;
};

type Props = SingleSelectProps | MultiSelectProps;

/** Grilla de disponibilidad de canchas por horario. En modo single-select
 * (default) solo una celda puede estar asignada a la vez — usado por el
 * scheduler de partidos ya creados. En modo multiSelect, cualquier cantidad
 * de celdas libres puede quedar marcada — usado por el wizard de creación
 * para bloquear varios horarios de una vez, antes de que el torneo exista. */
export function AvailabilityGrid(props: Props) {
  const { courts, slots, occupiedByCourtAndSlot } = props;
  const [showNightSlots, setShowNightSlots] = useState(false);

  if (slots.length === 0) {
    return (
      <p className="text-xs text-[var(--text-tertiary)]">
        No hay horarios configurados para esta fecha.
      </p>
    );
  }

  const visibleSlots = showNightSlots
    ? slots
    : slots.filter((s) => s >= "06:00" && s <= "23:30");

  function isSelected(courtId: string, slot: string) {
    if (props.multiSelect) {
      return Boolean(props.selectedSlots[`${courtId}:${slot}`]);
    }
    return props.selectedCourtId === courtId && props.selectedTime === slot;
  }

  function handleSelect(courtId: string, slot: string) {
    if (props.multiSelect) {
      props.onToggle(courtId, slot);
    } else {
      props.onSelect(courtId, slot);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="w-16 py-1 text-left font-mono text-[var(--text-tertiary)]">
              Hora
            </th>
            {courts.map((c) => (
              <th
                key={c.id}
                className="px-2 py-1 text-center font-semibold text-[var(--text-secondary)]"
              >
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleSlots.map((slot) => (
            <tr key={slot} className="border-t border-[var(--border-subtle)]">
              <td className="py-1.5 pr-3 font-mono text-[var(--text-tertiary)]">
                {slot}
              </td>
              {courts.map((court) => {
                const motivo = occupiedByCourtAndSlot[court.id]?.[slot];
                const selected = isSelected(court.id, slot);
                const isOcupado = Boolean(motivo);

                return (
                  <td key={court.id} className="px-1 py-1">
                    <button
                      type="button"
                      disabled={isOcupado}
                      onClick={() => !isOcupado && handleSelect(court.id, slot)}
                      className={`w-full rounded-lg px-2 py-1.5 text-center text-[10px] font-semibold transition ${
                        selected
                          ? "bg-[#0085FC] text-white"
                          : isOcupado
                            ? "cursor-not-allowed bg-rose-500/15 text-rose-400"
                            : "cursor-pointer bg-[var(--bg-subtle)] text-[var(--text-tertiary)] hover:bg-[#0085FC]/15 hover:text-[#0085FC]"
                      }`}
                    >
                      {selected ? "✓ Asignado" : isOcupado ? motivo : "Libre"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={() => setShowNightSlots((v) => !v)}
        className="mt-2 text-xs font-semibold text-[#0085FC] hover:underline"
      >
        {showNightSlots ? "Ver menos horarios" : "Ver más horarios (00:00 - 05:30)"}
      </button>
    </div>
  );
}
