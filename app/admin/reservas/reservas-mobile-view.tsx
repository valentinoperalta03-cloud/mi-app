"use client";

import Link from "next/link";
import { useState } from "react";
import { adminCTAPrimary } from "@/components/admin/admin-premium";

export type MobileSlotKind = "available" | "blocked" | "fixed" | "reservation";

export type MobileSlot = {
  time: string;
  kind: MobileSlotKind;
  player?: string;
  statusText?: string;
  financialStatus?: string | null;
  blockedReason?: string | null;
  href?: string;
};

export type MobileCourtData = {
  id: string;
  name: string;
  slots: MobileSlot[];
};

type BlockAction = (formData: FormData) => void | Promise<void>;

function finAccentClass(financialStatus?: string | null): string {
  if (financialStatus === "partially_paid") return "border-l-[3px] border-l-[var(--admin-accent-lima)]";
  if (financialStatus === "fully_paid") return "border-l-[3px] border-l-emerald-500";
  return "";
}

function SlotCard({
  slot,
  courtId,
  date,
  blockAction,
}: {
  slot: MobileSlot;
  courtId: string;
  date: string;
  blockAction: BlockAction;
}) {
  const [expanded, setExpanded] = useState(false);

  if (slot.kind === "reservation" || slot.kind === "fixed") {
    const isFixed = slot.kind === "fixed";
    return (
      <Link
        href={slot.href ?? "#"}
        className={`block rounded-2xl px-4 py-3.5 shadow-sm transition active:scale-[0.99] ${
          isFixed ? "border" : finAccentClass(slot.financialStatus)
        }`}
        style={
          isFixed
            ? { background: "var(--admin-accent-lima-subtle)", borderColor: "var(--admin-accent-lima-border)" }
            : { background: "var(--admin-brand-gradient)" }
        }
      >
        <div className="flex items-center justify-between gap-3">
          <span className={`shrink-0 text-sm font-semibold ${isFixed ? "text-[var(--text-primary)]" : "text-white"}`}>
            {slot.time}
          </span>
          <div className="min-w-0 flex-1 text-right">
            <p className={`truncate text-sm font-semibold ${isFixed ? "text-[var(--text-primary)]" : "text-white"}`}>
              {slot.player}
            </p>
            {isFixed ? (
              <span
                className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-[#031733]"
                style={{ backgroundColor: "var(--admin-accent-lima)" }}
              >
                Turno fijo
              </span>
            ) : (
              <p className="text-xs text-white/90">{slot.statusText}</p>
            )}
          </div>
        </div>
      </Link>
    );
  }

  if (slot.kind === "blocked") {
    return (
      <form
        action={blockAction}
        className="rounded-2xl border border-[var(--border-subtle)] px-4 py-3.5 shadow-sm"
        style={{
          backgroundColor: "var(--bg-app)",
          backgroundImage:
            "repeating-linear-gradient(45deg, var(--border-subtle) 0, var(--border-subtle) 1px, transparent 1px, transparent 8px)",
        }}
      >
        <input type="hidden" name="court_id" value={courtId} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="time" value={slot.time} />
        <button type="submit" className="flex w-full items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[var(--text-tertiary)]">{slot.time}</span>
          <span className="text-sm font-medium text-[var(--text-tertiary)]">{slot.blockedReason || "Bloqueado"}</span>
        </button>
      </form>
    );
  }

  // available
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3.5 shadow-sm">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">{slot.time}</span>
        <span className="text-sm font-medium text-[var(--text-tertiary)]">Disponible</span>
      </button>
      {expanded ? (
        <form action={blockAction} className="mt-3 space-y-2 border-t border-[var(--border-subtle)] pt-3">
          <input type="hidden" name="court_id" value={courtId} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="time" value={slot.time} />
          <input
            type="text"
            name="reason"
            placeholder="Motivo (opcional)"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm"
          />
          <button type="submit" className={`w-full ${adminCTAPrimary}`}>
            Bloquear horario
          </button>
        </form>
      ) : null}
    </div>
  );
}

export default function AdminReservasMobileView({
  courts,
  selectedDate,
  blockAction,
}: {
  courts: MobileCourtData[];
  selectedDate: string;
  blockAction: BlockAction;
}) {
  const [selectedCourtId, setSelectedCourtId] = useState(courts[0]?.id ?? "");
  const activeCourt = courts.find((c) => c.id === selectedCourtId) ?? courts[0];

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

      <div className="flex flex-col gap-2">
        {activeCourt.slots.map((slot) => (
          <SlotCard key={slot.time} slot={slot} courtId={activeCourt.id} date={selectedDate} blockAction={blockAction} />
        ))}
      </div>
    </div>
  );
}
