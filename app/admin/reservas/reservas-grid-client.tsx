"use client";

import Link from "next/link";
import { useState } from "react";
import ManualReservationModal from "./manual-reservation-modal";

export type GridCourt = { id: string; name: string };
export type GridCellData = { matchId: string; kind: "reservation" | "fixed"; label: string };

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

                if (!courtOpenHere) {
                  return (
                    <div
                      key={key}
                      className="min-h-[60px] border-r border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 p-2"
                    />
                  );
                }

                if (!cell) {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setModalCell({ courtId: court.id, courtName: court.name, time: slot })}
                      className="flex min-h-[60px] cursor-pointer items-center justify-center border border-dashed border-[var(--border-subtle)] p-2 text-lg font-medium text-[var(--text-tertiary)] transition-colors duration-200 hover:border-[#0085FC]/40 hover:bg-[rgba(0,133,252,0.06)] hover:text-[#0461C4]"
                      style={{ borderRadius: 8 }}
                    >
                      +
                    </button>
                  );
                }

                const isFixed = cell.kind === "fixed";
                return (
                  <Link
                    key={key}
                    href={`/admin/reservas?date=${selectedDate}&selected=${cell.matchId}`}
                    className="block min-h-[60px] border-r border-[var(--border-subtle)] p-2"
                  >
                    <div
                      className="h-full px-3 py-2 transition-transform duration-200 hover:scale-[1.01]"
                      style={{
                        borderRadius: 8,
                        background: isFixed ? "rgba(0,133,252,0.15)" : "rgba(34,197,94,0.15)",
                        borderLeft: `3px solid ${isFixed ? "#0085FC" : "#22C55E"}`,
                        color: isFixed ? "#0461C4" : "#15803D",
                      }}
                    >
                      <p className="truncate text-sm font-semibold">{cell.label}</p>
                      <p className="text-[11px] opacity-80">{isFixed ? "Turno fijo" : "Reserva"}</p>
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
