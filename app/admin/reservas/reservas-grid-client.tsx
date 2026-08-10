"use client";

import Link from "next/link";
import { useState } from "react";
import ManualReservationModal from "./manual-reservation-modal";

export type GridCourt = { id: string; name: string };
export type GridCellKind = "reservation" | "fixed" | "external";
export type GridCellData = { matchId?: string; kind: GridCellKind; label: string };

export default function ReservasGridClient({
  courts,
  slots,
  courtSlotTimes,
  cells,
  selectedDate,
}: {
  courts: GridCourt[];
  slots: string[];
  courtSlotTimes: Record<string, string[]>;
  cells: Record<string, GridCellData>;
  selectedDate: string;
}) {
  const [modalCell, setModalCell] = useState<{ courtId: string; courtName: string; time: string } | null>(null);

  if (slots.length === 0) {
    return <p className="p-4 text-sm text-[var(--text-tertiary)]">No hay horarios configurados para hoy.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <div className="min-w-[1100px]">
          <div className="grid" style={{ gridTemplateColumns: `84px repeat(${courts.length}, minmax(180px, 1fr))` }}>
            <div className="sticky left-0 z-20 flex items-center justify-end border-r border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-3 font-admin-mono text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Hora
            </div>
            {courts.map((court) => (
              <div
                key={court.id}
                className="border-r border-white/15 px-3 py-3 text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #0085FC, #0461C4)", borderRadius: "8px 8px 0 0" }}
              >
                {court.name}
              </div>
            ))}
          </div>

          {slots.map((slot) => (
            <div
              key={slot}
              className="grid border-b border-[var(--border-subtle)]"
              style={{ gridTemplateColumns: `84px repeat(${courts.length}, minmax(180px, 1fr))` }}
            >
              <div className="sticky left-0 z-10 border-r border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-4 text-right text-xs font-medium text-[var(--text-secondary)]">
                {slot}
              </div>
              {courts.map((court) => {
                const key = `${court.id}__${slot}`;
                const cell = cells[key];
                const courtOpenHere = courtSlotTimes[court.id]?.includes(slot) ?? false;

                // Celda inválida: la cancha no tiene este horario en ninguna de
                // sus franjas — vacía, sin fondo, sin borde, no clickeable.
                if (!courtOpenHere) {
                  return <div key={key} className="min-h-[60px] border-r border-[var(--border-subtle)]/40 p-2" />;
                }

                // Disponible
                if (!cell) {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setModalCell({ courtId: court.id, courtName: court.name, time: slot })}
                      className="flex min-h-[60px] cursor-pointer items-center justify-center border border-dashed border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] p-2 text-lg font-medium text-[var(--text-tertiary)] transition-colors duration-200 hover:border-[rgba(0,133,252,0.25)] hover:bg-[rgba(0,133,252,0.08)] hover:text-[#0085FC]"
                      style={{ borderRadius: 10 }}
                    >
                      +
                    </button>
                  );
                }

                // Evento externo: bloqueo manual, entrenamiento externo, bloqueo
                // recurrente del club. No clickeable.
                if (cell.kind === "external") {
                  return (
                    <div
                      key={key}
                      className="flex min-h-[60px] items-center justify-center border-r border-[var(--border-subtle)] p-2"
                    >
                      <div
                        className="flex h-full w-full cursor-default items-center justify-center px-3 py-2"
                        style={{
                          borderRadius: 10,
                          background: "rgba(239,68,68,0.08)",
                          borderLeft: "3px solid #EF4444",
                        }}
                      >
                        <p className="truncate text-sm font-semibold text-[#EF4444]">{cell.label}</p>
                      </div>
                    </div>
                  );
                }

                // Ocupada: turno fijo o reserva
                const isFixed = cell.kind === "fixed";
                return (
                  <Link
                    key={key}
                    href={`/admin/reservas?date=${selectedDate}&selected=${cell.matchId}`}
                    className="block min-h-[60px] border-r border-[var(--border-subtle)] p-2"
                  >
                    <div
                      className={`h-full px-3 py-2 transition-colors duration-200 ${
                        isFixed
                          ? "bg-[rgba(0,133,252,0.12)] hover:bg-[rgba(0,133,252,0.18)]"
                          : "bg-[rgba(34,197,94,0.12)] hover:bg-[rgba(34,197,94,0.18)]"
                      }`}
                      style={{
                        borderRadius: 10,
                        borderLeft: `3px solid ${isFixed ? "#0085FC" : "#22C55E"}`,
                      }}
                    >
                      <p className={`truncate text-sm font-bold ${isFixed ? "text-[#0461C4]" : "text-[#15803D]"}`}>
                        {cell.label}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">{isFixed ? "Turno fijo" : "Reserva"}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {modalCell ? (
        <ManualReservationModal
          courtId={modalCell.courtId}
          courtName={modalCell.courtName}
          date={selectedDate}
          time={modalCell.time}
          onClose={() => setModalCell(null)}
        />
      ) : null}
    </>
  );
}
