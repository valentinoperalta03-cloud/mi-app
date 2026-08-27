"use client";

import { useMemo, useState, type FormEvent } from "react";
import { parseClockToMinutes } from "@/lib/court-slots";
import { adminCTAPrimary, adminKicker } from "@/components/admin/admin-premium";
import { addExceptionToFixedSlot, createFixedSlot, deleteFixedSlot, updateFixedSlot } from "./actions";

export type GridCourt = { id: string; name: string };
export type GridPlayer = { playerId: string; name: string };
export type GridCell = {
  fixedSlotId: string;
  title: string;
  players: GridPlayer[];
  nextDateYmd: string;
  nextDateLabel: string;
  hasExceptionForNext: boolean;
};

const DAY_OPTIONS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

/** Indexado por day_of_week (0=Domingo..6=Sabado), a diferencia de DAY_OPTIONS que ordena Lunes primero para los chips. */
const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type ModalContext = { courtId: string; courtName: string; dayOfWeek: number; time: string };
type EditContext = { cell: GridCell; courtId: string; courtName: string; dayOfWeek: number; time: string };

function cellKey(dayOfWeek: number, courtId: string, time: string) {
  return `${dayOfWeek}__${courtId}__${time}`;
}

export default function TurnosFijosGrid({
  courts,
  availableSlotsByCourtAndDay,
  cells,
  initialDay,
}: {
  courts: GridCourt[];
  availableSlotsByCourtAndDay: Record<string, Record<number, string[]>>;
  cells: Record<string, GridCell>;
  initialDay: number;
}) {
  const [activeDay, setActiveDay] = useState(initialDay);
  const [modalCtx, setModalCtx] = useState<ModalContext | null>(null);
  const [editCtx, setEditCtx] = useState<EditContext | null>(null);

  // Slots por cancha para el día activo: unión de los horarios disponibles
  // (court_time_ranges/horario de club) + los horarios de turnos fijos ya
  // existentes de esa cancha, por si quedaron fuera del rango vigente.
  const slotsByCourt = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const court of courts) {
      const set = new Set(availableSlotsByCourtAndDay[court.id]?.[activeDay] ?? []);
      for (const key of Object.keys(cells)) {
        const [dayStr, courtIdStr, time] = key.split("__");
        if (Number(dayStr) === activeDay && courtIdStr === court.id) set.add(time);
      }
      result[court.id] = Array.from(set).sort((a, b) => parseClockToMinutes(a) - parseClockToMinutes(b));
    }
    return result;
  }, [courts, availableSlotsByCourtAndDay, activeDay, cells]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAY_OPTIONS.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setActiveDay(d.value)}
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

      {courts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-10 text-center text-sm text-[var(--text-tertiary)]">
          Cargá al menos una cancha para poder configurar turnos fijos.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[640px] gap-3"
            style={{ gridTemplateColumns: `repeat(${courts.length}, minmax(0, 1fr))` }}
          >
            {courts.map((court) => {
              const slots = slotsByCourt[court.id] ?? [];
              return (
                <div key={court.id} className="flex flex-col gap-2">
                  <div className="rounded-xl bg-[#0085FC] px-3 py-2.5 text-center text-sm font-bold text-white">
                    {court.name}
                  </div>

                  {slots.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-3 py-4 text-center text-[11px] text-[var(--text-tertiary)]">
                      Sin horarios disponibles.
                    </p>
                  ) : (
                    slots.map((slot) => {
                      const cell = cells[cellKey(activeDay, court.id, slot)];
                      return cell ? (
                        <button
                          key={slot}
                          type="button"
                          onClick={() =>
                            setEditCtx({ cell, courtId: court.id, courtName: court.name, dayOfWeek: activeDay, time: slot })
                          }
                          className="cursor-pointer rounded-xl border-2 border-[#0085FC] bg-[#0085FC]/10 px-3 py-3 text-left transition-colors duration-200 hover:bg-[#0085FC]/20"
                        >
                          <p className="font-mono text-[11px] text-[#0461C4] dark:text-sky-300">{slot}hs</p>
                          <p className="mt-0.5 truncate text-sm font-bold text-[var(--text-primary)]">
                            {cell.title || "Turno fijo"}
                          </p>
                        </button>
                      ) : (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setModalCtx({ courtId: court.id, courtName: court.name, dayOfWeek: activeDay, time: slot })}
                          className="cursor-pointer rounded-xl border border-dashed border-[var(--border-subtle)] bg-transparent px-3 py-3 text-center text-xs text-[var(--text-tertiary)] transition-colors duration-200 hover:border-[#0085FC] hover:text-[#0461C4] dark:hover:text-sky-300"
                        >
                          <span className="block font-mono">{slot}hs</span>
                          <span className="text-[10px]">+ Turno fijo</span>
                        </button>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modalCtx ? <CreateModal ctx={modalCtx} onClose={() => setModalCtx(null)} /> : null}
      {editCtx ? <EditModal ctx={editCtx} onClose={() => setEditCtx(null)} /> : null}
    </div>
  );
}

function CreateModal({ ctx, onClose }: { ctx: ModalContext; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const dayLabel = DAY_LABELS[ctx.dayOfWeek] ?? "";

  async function handleCreate() {
    if (!title.trim()) return;
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.set("court_id", ctx.courtId);
    fd.set("day_of_week", String(ctx.dayOfWeek));
    fd.set("start_time", ctx.time);
    fd.set("duration_minutes", "90");
    fd.set("title", title.trim());
    fd.set("players_payload", "[]");
    const res = await createFixedSlot(fd);
    setPending(false);
    if (res?.error) setError(res.error);
    else onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(4px)", background: "rgba(3,23,51,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[var(--admin-card-radius)] border border-[var(--admin-card-border)] bg-[var(--admin-card-bg)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div>
            <p className={adminKicker}>
              {dayLabel} · {ctx.time}hs · {ctx.courtName}
            </p>
            <h2 className="mt-1 text-lg font-bold text-[var(--text-primary)]">Nuevo turno fijo</h2>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Nombre del jugador</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='Ej: "Peralta"'
              autoFocus
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2.5 text-[var(--text-primary)] outline-none focus:border-[#0085FC]"
            />
          </div>

          <p className="text-xs text-[var(--text-tertiary)]">⏱ Duración: 90 minutos</p>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--border-subtle)] py-2.5 text-sm font-semibold text-[var(--text-secondary)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!title.trim() || pending}
              className="flex-1 rounded-xl bg-[#0085FC] py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              {pending ? "Guardando..." : "Guardar turno"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditModal({ ctx, onClose }: { ctx: EditContext; onClose: () => void }) {
  const { cell } = ctx;
  const [editTitle, setEditTitle] = useState(cell.title);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const dayLabel = DAY_LABELS[ctx.dayOfWeek] ?? "";

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editTitle.trim()) return;
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.set("fixed_slot_id", cell.fixedSlotId);
    fd.set("title", editTitle.trim());
    fd.set("player_ids", JSON.stringify(cell.players.map((p) => p.playerId)));
    const res = await updateFixedSlot(fd);
    setPending(false);
    if (res?.error) setError(res.error);
    else onClose();
  }

  async function handleException() {
    if (!confirm(`¿No viene el ${cell.nextDateLabel}? La cancha queda libre ese día.`)) return;
    setActionPending(true);
    const fd = new FormData();
    fd.set("fixed_slot_id", cell.fixedSlotId);
    fd.set("exception_date", cell.nextDateYmd);
    await addExceptionToFixedSlot(fd);
    setActionPending(false);
    onClose();
  }

  async function handleDelete() {
    if (!confirm("¿Dar de baja este turno fijo? Se cancelan todos los partidos futuros.")) return;
    setActionPending(true);
    const fd = new FormData();
    fd.set("fixed_slot_id", cell.fixedSlotId);
    await deleteFixedSlot(fd);
    setActionPending(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(4px)", background: "rgba(3,23,51,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[var(--admin-card-radius)] border border-[var(--admin-card-border)] bg-[var(--admin-card-bg)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <p className={adminKicker}>EDITAR TURNO FIJO</p>
            <h2 className="mt-1 text-lg font-bold text-[var(--text-primary)]">{cell.title}</h2>
            <p className="text-xs text-[var(--text-tertiary)]">
              {dayLabel} · {ctx.time}hs · {ctx.courtName}
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Nombre del jugador</label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2.5 text-[var(--text-primary)] outline-none focus:border-[#0085FC]"
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!editTitle.trim() || pending}
            className="w-full rounded-xl bg-[#0085FC] py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            {pending ? "Guardando..." : "Guardar cambios"}
          </button>

          <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
            {cell.hasExceptionForNext ? (
              <p className="text-center text-xs font-medium text-[var(--text-tertiary)]">
                Ya está libre el {cell.nextDateLabel}.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleException}
                disabled={actionPending}
                className="w-full rounded-xl border border-amber-400 bg-amber-400/20 py-2.5 text-sm font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-300"
              >
                📅 No viene esta semana
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={actionPending}
              className="w-full rounded-xl border border-rose-400 bg-rose-400/20 py-2.5 text-sm font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-400"
            >
              🗑 Dar de baja permanentemente
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
}
