"use client";

import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";
import { DB_TABLES } from "@/lib/db-tables";
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

type PlayerResult = { user_id: string; name: string | null };
type ModalContext = { courtId: string; courtName: string; dayOfWeek: number; time: string };

function cellKey(dayOfWeek: number, courtId: string, time: string) {
  return `${dayOfWeek}__${courtId}__${time}`;
}

export default function TurnosFijosGrid({
  courts,
  times,
  cells,
  initialDay,
}: {
  courts: GridCourt[];
  times: string[];
  cells: Record<string, GridCell>;
  initialDay: number;
}) {
  const [activeDay, setActiveDay] = useState(initialDay);
  const [modalCtx, setModalCtx] = useState<ModalContext | null>(null);
  const [editCell, setEditCell] = useState<GridCell | null>(null);

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
        <div className="overflow-hidden rounded-2xl border border-[var(--admin-card-border)]">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid" style={{ gridTemplateColumns: `72px repeat(${courts.length}, minmax(160px, 1fr))` }}>
                <div className="sticky left-0 z-10 border-b border-r border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-3" />
                {courts.map((court) => (
                  <div
                    key={court.id}
                    className="border-b border-r border-white/15 px-3 py-3 text-sm font-semibold text-white last:border-r-0"
                    style={{ background: "var(--admin-brand-gradient)" }}
                  >
                    {court.name}
                  </div>
                ))}
              </div>

              {times.map((time) => (
                <div
                  key={time}
                  className="grid"
                  style={{ gridTemplateColumns: `72px repeat(${courts.length}, minmax(160px, 1fr))` }}
                >
                  <div className="sticky left-0 z-10 flex items-center justify-end border-b border-r border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-2 text-xs font-medium text-[var(--text-secondary)]">
                    {time}
                  </div>
                  {courts.map((court) => {
                    const key = cellKey(activeDay, court.id, time);
                    const cell = cells[key];
                    return (
                      <div key={key} className="border-b border-r border-[var(--border-subtle)] p-1.5 last:border-r-0">
                        {cell ? (
                          <OccupiedCell cell={cell} onEdit={() => setEditCell(cell)} />
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setModalCtx({ courtId: court.id, courtName: court.name, dayOfWeek: activeDay, time })
                            }
                            className="flex h-full min-h-16 w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-transparent text-[11px] font-medium text-[var(--text-tertiary)] transition-all duration-200 hover:border-[#0085FC]/50 hover:bg-[#0085FC]/[0.06] hover:text-[#0461C4] active:scale-[0.97] dark:hover:text-sky-300"
                          >
                            + Turno fijo
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalCtx ? <CreateModal ctx={modalCtx} onClose={() => setModalCtx(null)} /> : null}
      {editCell ? <EditModal cell={editCell} onClose={() => setEditCell(null)} /> : null}
    </div>
  );
}

// Tamaño fijo: mismas dimensiones que la celda vacía (min-h-16), sin filas de
// botones adentro. Al hacer click abre el modal de edición — el hover solo
// oscurece el fondo, nunca cambia el tamaño de la celda.
function OccupiedCell({ cell, onEdit }: { cell: GridCell; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex h-full min-h-16 w-full cursor-pointer flex-col items-start justify-center gap-0.5 overflow-hidden rounded-xl border px-2.5 py-2 text-left transition-colors duration-200 hover:brightness-95 dark:hover:brightness-110"
      style={{ background: "rgba(0,133,252,0.08)", borderColor: "rgba(0,133,252,0.25)" }}
    >
      <p className="w-full truncate text-xs font-bold text-[#0461C4] dark:text-sky-300">{cell.title}</p>
      {cell.players.length > 0 ? (
        <p className="w-full truncate text-[10px] text-[var(--text-tertiary)]">
          {cell.players.map((p) => p.name).join(", ")}
        </p>
      ) : null}
      {cell.hasExceptionForNext ? (
        <span className="w-full truncate text-[9px] font-semibold text-amber-600 dark:text-amber-400">
          Libre el {cell.nextDateLabel}
        </span>
      ) : null}
    </button>
  );
}

function EditModal({ cell, onClose }: { cell: GridCell; onClose: () => void }) {
  const [title, setTitle] = useState(cell.title);
  const [selected, setSelected] = useState<GridPlayer[]>(cell.players);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  async function searchPlayers(next: string) {
    setQuery(next);
    if (next.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from(DB_TABLES.profiles)
      .select("user_id,name")
      .ilike("name", `%${next.trim()}%`)
      .limit(4);
    setResults((data ?? []) as PlayerResult[]);
    setLoading(false);
  }

  function addPlayer(player: PlayerResult) {
    if (selected.some((p) => p.playerId === player.user_id) || selected.length >= 4) return;
    setSelected((prev) => [...prev, { playerId: player.user_id, name: player.name?.trim() || "Jugador" }]);
    setQuery("");
    setResults([]);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fd = new FormData();
    fd.set("fixed_slot_id", cell.fixedSlotId);
    fd.set("title", title.trim());
    fd.set("player_ids", JSON.stringify(selected.map((p) => p.playerId)));
    const res = await updateFixedSlot(fd);
    setSubmitting(false);
    if (res?.error) setError(res.error);
    else onClose();
  }

  async function handleNoVieneEstaSemana() {
    if (!confirm(`¿No viene el ${cell.nextDateLabel}? La cancha queda libre ese día.`)) return;
    setActionPending(true);
    const fd = new FormData();
    fd.set("fixed_slot_id", cell.fixedSlotId);
    fd.set("exception_date", cell.nextDateYmd);
    await addExceptionToFixedSlot(fd);
    setActionPending(false);
    onClose();
  }

  async function handleDarDeBaja() {
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
        <p className={adminKicker}>Editar turno fijo</p>
        <h3 className="mt-1 text-lg font-bold text-[var(--text-primary)]">{cell.title}</h3>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <label className="block text-sm font-semibold text-[var(--text-secondary)]">
            Título
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </label>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--text-secondary)]">Jugadores</p>
            {selected.length > 0 ? (
              <ul className="space-y-1.5">
                {selected.map((p) => (
                  <li
                    key={p.playerId}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3 py-1.5"
                  >
                    <span className="flex-1 text-sm font-medium text-[var(--text-secondary)]">{p.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelected((prev) => prev.filter((x) => x.playerId !== p.playerId))}
                      aria-label={`Quitar a ${p.name}`}
                      className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-sm font-bold text-rose-600 transition-all duration-200 hover:bg-rose-500/10 active:scale-95 dark:text-rose-300"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">Sin jugadores asignados.</p>
            )}

            {selected.length < 4 ? (
              <>
                <input
                  value={query}
                  onChange={(e) => void searchPlayers(e.target.value)}
                  placeholder="Buscar por nombre para agregar"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
                {loading ? <p className="text-xs text-[var(--text-tertiary)]">Buscando...</p> : null}
                {results.length > 0 ? (
                  <ul className="space-y-1 rounded-xl border border-[var(--border-subtle)] p-2">
                    {results
                      .filter((r) => !selected.some((p) => p.playerId === r.user_id))
                      .map((r) => (
                        <li key={r.user_id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-[var(--text-secondary)]">{r.name ?? "Jugador"}</span>
                          <button
                            type="button"
                            onClick={() => addPlayer(r)}
                            className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[#0085FC]/30 bg-[#0085FC]/10 px-3 text-xs font-semibold text-[#0461C4] transition-all duration-200 hover:bg-[#0085FC]/20 active:scale-95"
                          >
                            Agregar
                          </button>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border border-[var(--border-strong)] px-4 text-sm font-semibold text-[var(--text-primary)] transition-all duration-200 hover:bg-[var(--bg-subtle)] active:scale-[0.97]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg ${adminCTAPrimary} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {submitting ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>

        <div className="my-4 border-t border-[var(--border-subtle)]" />

        <div className="space-y-2">
          {cell.hasExceptionForNext ? (
            <p className="text-center text-xs font-medium text-[var(--text-tertiary)]">
              Ya está libre el {cell.nextDateLabel}.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleNoVieneEstaSemana}
              disabled={actionPending}
              className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg border border-[var(--admin-alert-warning-border)] bg-[var(--admin-alert-warning-bg)] px-4 text-sm font-semibold text-[var(--admin-alert-warning-text)] transition-all duration-200 hover:brightness-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:brightness-125"
            >
              No viene esta semana
            </button>
          )}
          <button
            type="button"
            onClick={handleDarDeBaja}
            disabled={actionPending}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg border border-[var(--admin-alert-error-border)] bg-[var(--admin-alert-error-bg)] px-4 text-sm font-semibold text-rose-700 transition-all duration-200 hover:brightness-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-300 dark:hover:brightness-125"
          >
            Dar de baja
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateModal({ ctx, onClose }: { ctx: ModalContext; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [selected, setSelected] = useState<GridPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const playersPayload = useMemo(() => JSON.stringify(selected.map((p) => ({ playerId: p.playerId }))), [selected]);
  const dayLabel = DAY_OPTIONS.find((d) => d.value === ctx.dayOfWeek)?.label ?? "";

  async function searchPlayers(next: string) {
    setQuery(next);
    if (next.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from(DB_TABLES.profiles)
      .select("user_id,name")
      .ilike("name", `%${next.trim()}%`)
      .limit(4);
    setResults((data ?? []) as PlayerResult[]);
    setLoading(false);
  }

  function addPlayer(player: PlayerResult) {
    if (selected.some((p) => p.playerId === player.user_id) || selected.length >= 4) return;
    setSelected((prev) => [...prev, { playerId: player.user_id, name: player.name?.trim() || "Jugador" }]);
    setQuery("");
    setResults([]);
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
        <p className={adminKicker}>
          {dayLabel} · {ctx.time}hs · {ctx.courtName}
        </p>
        <h3 className="mt-1 text-lg font-bold text-[var(--text-primary)]">Nuevo turno fijo</h3>

        <form
          action={async (formData) => {
            setError(null);
            setSubmitting(true);
            const res = await createFixedSlot(formData);
            setSubmitting(false);
            if (res?.error) setError(res.error);
            else onClose();
          }}
          className="mt-4 space-y-4"
        >
          <input type="hidden" name="court_id" value={ctx.courtId} />
          <input type="hidden" name="day_of_week" value={ctx.dayOfWeek} />
          <input type="hidden" name="start_time" value={ctx.time} />

          <label className="block text-sm font-semibold text-[var(--text-secondary)]">
            Título del turno
            <input
              name="title"
              required
              placeholder='Ej: "Peralta"'
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </label>

          <label className="block text-sm font-semibold text-[var(--text-secondary)]">
            Duración (min)
            <input
              name="duration_minutes"
              defaultValue="90"
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </label>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--text-secondary)]">Agregar jugadores (opcional)</p>
            <input
              value={query}
              onChange={(e) => void searchPlayers(e.target.value)}
              placeholder="Buscar por nombre"
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            {loading ? <p className="text-xs text-[var(--text-tertiary)]">Buscando...</p> : null}
            {results.length > 0 ? (
              <ul className="space-y-1 rounded-xl border border-[var(--border-subtle)] p-2">
                {results.map((r) => (
                  <li key={r.user_id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-[var(--text-secondary)]">{r.name ?? "Jugador"}</span>
                    <button
                      type="button"
                      onClick={() => addPlayer(r)}
                      className="rounded-lg border border-[#0085FC]/30 bg-[#0085FC]/10 px-2 py-1 text-xs font-semibold text-[#0461C4]"
                    >
                      Agregar
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selected.length > 0 ? (
              <ul className="space-y-1.5">
                {selected.map((p) => (
                  <li
                    key={p.playerId}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-3 py-1.5"
                  >
                    <span className="flex-1 text-sm font-medium text-[var(--text-secondary)]">{p.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelected((prev) => prev.filter((x) => x.playerId !== p.playerId))}
                      className="text-xs font-semibold text-rose-600 dark:text-rose-300"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">
                Podés crear el turno sin jugadores y sumarlos después.
              </p>
            )}
          </div>

          <input type="hidden" name="players_payload" value={playersPayload} />

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)]"
            >
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className={`flex-1 ${adminCTAPrimary} disabled:opacity-60`}>
              {submitting ? "Guardando..." : "Guardar turno fijo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
