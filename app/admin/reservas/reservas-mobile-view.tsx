"use client";

import Link from "next/link";
import { useState } from "react";
import ManualReservationModal from "./manual-reservation-modal";

export type MobileSlotKind = "available" | "fixed" | "reservation" | "external";

export type MobileSlot = {
  time: string;
  kind: MobileSlotKind;
  matchId?: string;
  label?: string;
};

export type MobileCourtData = {
  id: string;
  name: string;
  slots: MobileSlot[];
};

function SlotCard({
  slot,
  courtId,
  courtName,
  date,
  onOpenCreate,
}: {
  slot: MobileSlot;
  courtId: string;
  courtName: string;
  date: string;
  onOpenCreate: (courtId: string, courtName: string, time: string) => void;
}) {
  if (slot.kind === "reservation" || slot.kind === "fixed") {
    const isFixed = slot.kind === "fixed";
    return (
      <Link
        href={`/admin/reservas?date=${date}&selected=${slot.matchId}`}
        className={`block rounded-[10px] px-4 py-3.5 shadow-sm transition-colors duration-200 active:scale-[0.99] ${
          isFixed ? "bg-[rgba(0,133,252,0.12)]" : "bg-[rgba(34,197,94,0.12)]"
        }`}
        style={{ borderLeft: `3px solid ${isFixed ? "#0085FC" : "#22C55E"}` }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className={`shrink-0 text-sm font-semibold ${isFixed ? "text-[#0461C4]" : "text-[#15803D]"}`}>
            {slot.time}
          </span>
          <div className="min-w-0 flex-1 text-right">
            <p className={`truncate text-sm font-bold ${isFixed ? "text-[#0461C4]" : "text-[#15803D]"}`}>
              {slot.label}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">{isFixed ? "Turno fijo" : "Reserva"}</p>
          </div>
        </div>
      </Link>
    );
  }

  if (slot.kind === "external") {
    return (
      <div
        className="flex cursor-default items-center justify-between gap-3 rounded-[10px] px-4 py-3.5"
        style={{ background: "rgba(239,68,68,0.08)", borderLeft: "3px solid #EF4444" }}
      >
        <span className="text-sm font-semibold text-[#EF4444]">{slot.time}</span>
        <span className="text-sm font-bold text-[#EF4444]">{slot.label}</span>
      </div>
    );
  }

  // available
  return (
    <button
      type="button"
      onClick={() => onOpenCreate(courtId, courtName, slot.time)}
      className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-dashed border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] px-4 py-3.5 text-left transition-colors duration-200 hover:border-[rgba(0,133,252,0.25)] hover:bg-[rgba(0,133,252,0.08)]"
    >
      <span className="text-sm font-semibold text-[var(--text-secondary)]">{slot.time}</span>
      <span className="text-lg font-medium text-[var(--text-tertiary)]">+</span>
    </button>
  );
}

export default function AdminReservasMobileView({
  courts,
  selectedDate,
}: {
  courts: MobileCourtData[];
  selectedDate: string;
}) {
  const [selectedCourtId, setSelectedCourtId] = useState(courts[0]?.id ?? "");
  const activeCourt = courts.find((c) => c.id === selectedCourtId) ?? courts[0];
  const [modalCell, setModalCell] = useState<{ courtId: string; courtName: string; time: string } | null>(null);

  if (!activeCourt) return null;

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {courts.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {courts.map((c) => {
            const active = c.id === activeCourt.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCourtId(c.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active ? "text-white" : "bg-[var(--bg-card)] text-[var(--text-secondary)]"
                }`}
                style={active ? { background: "var(--admin-brand-gradient)" } : undefined}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {activeCourt.slots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
          No hay horarios configurados para hoy.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {activeCourt.slots.map((slot) => (
            <SlotCard
              key={slot.time}
              slot={slot}
              courtId={activeCourt.id}
              courtName={activeCourt.name}
              date={selectedDate}
              onOpenCreate={(courtId, courtName, time) => setModalCell({ courtId, courtName, time })}
            />
          ))}
        </div>
      )}

      {modalCell ? (
        <ManualReservationModal
          courtId={modalCell.courtId}
          courtName={modalCell.courtName}
          date={selectedDate}
          time={modalCell.time}
          onClose={() => setModalCell(null)}
        />
      ) : null}
    </div>
  );
}
