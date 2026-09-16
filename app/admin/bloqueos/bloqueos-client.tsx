"use client";

import { useCallback, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Ban, CalendarOff, CheckCircle2, Info, Lock } from "lucide-react";
import AdminPageHeader from "@/components/admin/admin-page-header";
import AdminFlashMessage from "@/components/admin/admin-flash-message";
import {
  adminButtonGhost,
  adminCard,
  adminCTADangerCompact,
  adminCTAPrimary,
  adminEmptyState,
  adminKicker,
  adminPressable,
  adminSectionLabel,
} from "@/components/admin/admin-premium";
import {
  closeDayAction,
  createManualBlocksAction,
  getBlockGridAction,
  previewDayAction,
  removeClosedDayAction,
  removeManualBlockAction,
  type ActivityGroup,
  type BlockConflict,
  type BlockGridCourt,
  type DayPreview,
} from "./actions";

export type CourtOption = { id: string; name: string };
export type ClosedDayRow = { id: string; closed_date: string; reason: string | null };
export type BlockRow = {
  id: string;
  courtName: string;
  blocked_date: string;
  blocked_time: string;
  note: string | null;
};

type Flash = { type: "success" | "error"; message: string } | null;
type Panel = "none" | "day" | "slot";

function formatDay(ymd: string): string {
  try {
    return format(parseISO(`${ymd}T12:00:00`), "EEEE d 'de' MMMM yyyy", { locale: es });
  } catch {
    return ymd;
  }
}

function formatShortDay(ymd: string): string {
  try {
    return format(parseISO(`${ymd}T12:00:00`), "EEE d MMM yyyy", { locale: es });
  } catch {
    return ymd;
  }
}

const inputClass =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]";

function GroupList({ groups, tone }: { groups: ActivityGroup[]; tone: "blocker" | "info" }) {
  const isBlocker = tone === "blocker";
  return (
    <ul className="flex flex-col gap-2">
      {groups.map((g) => (
        <li
          key={g.kind}
          className={`rounded-xl border px-3 py-2 ${
            isBlocker
              ? "border-[var(--admin-alert-error-border)] bg-[var(--admin-alert-error-bg)]"
              : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
          }`}
        >
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {g.count} {g.label}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{g.hint}</p>
        </li>
      ))}
    </ul>
  );
}

function DayPreviewBox({ preview }: { preview: DayPreview }) {
  if (preview.alreadyClosed) {
    return (
      <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Ese día ya está cerrado.</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {preview.canClose
            ? "Quedaron turnos fijos sin saltear. Volvé a cerrar el día para terminar."
            : "Lo podés reabrir desde la lista de abajo."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div>
        <p className={adminSectionLabel}>{preview.dateLabel}</p>
        {preview.totalActivity === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={16} className="shrink-0" />
            No hay nada agendado ese día.
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Actividad programada para esa fecha:</p>
        )}
      </div>

      {preview.blockers.length > 0 ? (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-rose-700 dark:text-rose-300">
            <AlertTriangle size={15} className="shrink-0" />
            Tenés que resolver esto antes de cerrar
          </p>
          <GroupList groups={preview.blockers} tone="blocker" />
        </div>
      ) : null}

      {preview.resolvable.length > 0 ? (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)]">
            <Info size={15} className="shrink-0 text-[var(--text-tertiary)]" />
            Se resuelve solo al cerrar
          </p>
          <GroupList groups={preview.resolvable} tone="info" />
        </div>
      ) : null}

      {preview.lines.length > 0 ? (
        <details className="rounded-xl border border-[var(--border-subtle)] px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--text-secondary)]">
            Ver el detalle ({preview.lines.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {preview.lines.map((l, i) => (
              <li key={`${l.kind}-${i}`} className="flex flex-wrap gap-x-2 text-xs text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">{l.time || "—"}</span>
                <span>{l.courtName}</span>
                <span className="text-[var(--text-tertiary)]">· {l.detail}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function CloseDayPanel({ todayYmd, onDone }: { todayYmd: string; onDone: (f: Flash) => void }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<DayPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  const loadPreview = useCallback((value: string) => {
    if (!value) {
      setPreview(null);
      setPreviewError("");
      return;
    }
    startLoading(async () => {
      const result = await previewDayAction(value);
      if (result.ok) {
        setPreview(result);
        setPreviewError("");
      } else {
        setPreview(null);
        setPreviewError(result.error);
      }
    });
  }, []);

  function submit() {
    if (!preview?.canClose) return;
    const formData = new FormData();
    formData.set("closed_date", date);
    formData.set("reason", reason);
    startSaving(async () => {
      const result = await closeDayAction(formData);
      if (result.ok) {
        setDate("");
        setReason("");
        setPreview(null);
        onDone({ type: "success", message: result.message });
      } else {
        onDone({ type: "error", message: result.error });
        loadPreview(date);
      }
    });
  }

  return (
    <div className={adminCard}>
      <p className={adminKicker}>Cerrar día completo</p>
      <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">Elegí la fecha que no abrís</p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Ese día no se ofrece ningún turno, en ninguna cancha. Antes de cerrar te mostramos qué hay agendado.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Fecha</span>
          <input
            type="date"
            value={date}
            min={todayYmd}
            onChange={(e) => {
              setDate(e.target.value);
              loadPreview(e.target.value);
            }}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Motivo (opcional)</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Feriado, lluvia, mantenimiento..."
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>

      {previewError ? <p className="mt-3 text-sm text-rose-600">{previewError}</p> : null}
      {loading ? <p className="mt-3 text-sm text-[var(--text-tertiary)]">Revisando la actividad de ese día...</p> : null}
      {!loading && preview ? <DayPreviewBox preview={preview} /> : null}

      {preview && (!preview.alreadyClosed || preview.canClose) ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={!preview.canClose || saving}
            className={`${adminCTAPrimary} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {saving ? "Cerrando..." : "Cerrar día"}
          </button>
          {!preview.canClose ? (
            <span className="text-xs text-[var(--text-tertiary)]">
              Resolvé la actividad bloqueante y volvé a elegir la fecha.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const slotKey = (courtId: string, time: string) => `${courtId}|${time}`;

function BlockSlotPanel({
  courts,
  todayYmd,
  onDone,
}: {
  courts: CourtOption[];
  todayYmd: string;
  onDone: (f: Flash) => void;
}) {
  const [date, setDate] = useState("");
  const [courtIds, setCourtIds] = useState<Set<string>>(() => new Set(courts.map((c) => c.id)));
  const [grid, setGrid] = useState<BlockGridCourt[] | null>(null);
  const [dayClosed, setDayClosed] = useState(false);
  const [gridError, setGridError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [conflicts, setConflicts] = useState<BlockConflict[]>([]);
  const [note, setNote] = useState("");
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  const loadGrid = useCallback((nextDate: string, keepSelection?: Set<string>) => {
    if (!nextDate) {
      setGrid(null);
      setGridError("");
      setDayClosed(false);
      setSelected(new Set());
      return;
    }
    startLoading(async () => {
      const result = await getBlockGridAction(nextDate);
      if (!result.ok) {
        setGrid(null);
        setDayClosed(false);
        setGridError(result.error);
        setSelected(new Set());
        return;
      }
      setGrid(result.courts);
      setDayClosed(result.dayClosed);
      setGridError("");
      // Tras un rechazo se conserva lo elegido que sigue libre; al cambiar de fecha se limpia.
      const free = new Set(
        result.courts.flatMap((c) => c.slots.filter((s) => !s.occupied).map((s) => slotKey(c.id, s.time)))
      );
      setSelected(new Set([...(keepSelection ?? [])].filter((k) => free.has(k))));
    });
  }, []);

  const visibleCourts = (grid ?? []).filter((c) => courtIds.has(c.id));
  const times = Array.from(new Set(visibleCourts.flatMap((c) => c.slots.map((s) => s.time)))).sort();
  const endByTime = new Map(visibleCourts.flatMap((c) => c.slots.map((s) => [s.time, s.endTime] as const)));
  const slotAt = (court: BlockGridCourt, time: string) => court.slots.find((s) => s.time === time) ?? null;
  const freeKeysOf = (list: BlockGridCourt[], time?: string) =>
    list.flatMap((c) =>
      c.slots.filter((s) => !s.occupied && (time === undefined || s.time === time)).map((s) => slotKey(c.id, s.time))
    );
  const conflictKeys = new Set(conflicts.map((c) => slotKey(c.courtId, c.time)));
  const selectedVisible = [...selected].filter((k) => courtIds.has(k.split("|")[0]!));
  const count = selectedVisible.length;

  function toggleKey(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** Si ya están todas elegidas las quita; si no, agrega las que falten. */
  function toggleGroup(keys: string[]) {
    if (!keys.length) return;
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = keys.every((k) => next.has(k));
      for (const k of keys) {
        if (allOn) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  function toggleCourt(id: string) {
    setCourtIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSelected((sel) => new Set([...sel].filter((k) => !k.startsWith(`${id}|`))));
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function submit() {
    if (!date || count === 0) return;
    const slots = selectedVisible.map((k) => {
      const [courtId, time] = k.split("|") as [string, string];
      return { courtId, startTime: time, endTime: endByTime.get(time) };
    });
    startSaving(async () => {
      const result = await createManualBlocksAction({ date, note, slots });
      if (result.ok) {
        setConflicts([]);
        setSelected(new Set());
        setNote("");
        setGrid(null);
        setDate("");
        onDone({ type: "success", message: result.message });
        return;
      }
      setConflicts(result.conflicts);
      onDone({ type: "error", message: result.error });
      loadGrid(date, new Set(selected));
    });
  }

  const allCourtsOn = courts.length > 0 && courts.every((c) => courtIds.has(c.id));

  return (
    <div className={adminCard}>
      <p className={adminKicker}>Bloquear horarios</p>
      <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">Sacá turnos de circulación</p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Elegí una fecha, las canchas y los turnos exactos. Solo se pueden bloquear turnos libres; si alguno se ocupa
        antes de confirmar, no se bloquea ninguno.
      </p>

      {courts.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-tertiary)]">Todavía no tenés canchas cargadas.</p>
      ) : (
        <>
          <label className="mt-4 block sm:max-w-xs">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">1. Fecha</span>
            <input
              type="date"
              value={date}
              min={todayYmd}
              onChange={(e) => {
                setDate(e.target.value);
                setConflicts([]);
                loadGrid(e.target.value);
              }}
              className={`mt-1 ${inputClass}`}
            />
          </label>

          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">2. Canchas</span>
              {courts.length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (allCourtsOn) {
                      setCourtIds(new Set());
                      setSelected(new Set());
                    } else {
                      setCourtIds(new Set(courts.map((c) => c.id)));
                    }
                  }}
                  className="text-xs font-semibold text-[#0085FC]"
                >
                  {allCourtsOn ? "Quitar todas" : "Seleccionar todas"}
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {courts.map((c) => {
                const on = courtIds.has(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                      on
                        ? "border-[#0085FC]/40 bg-[#0085FC]/10 text-[#0085FC]"
                        : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleCourt(c.id)}
                      className="h-4 w-4 accent-[#0085FC]"
                    />
                    {c.name}
                  </label>
                );
              })}
            </div>
          </div>

          {gridError ? <p className="mt-3 text-sm text-rose-600">{gridError}</p> : null}
          {loading ? <p className="mt-3 text-sm text-[var(--text-tertiary)]">Buscando los turnos de ese día...</p> : null}

          {!loading && dayClosed ? (
            <p className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
              Ese día el club ya está cerrado. Los bloqueos se guardan igual y siguen valiendo si después reabrís la fecha.
            </p>
          ) : null}

          {conflicts.length > 0 ? (
            <div className="mt-3 rounded-xl border border-[var(--admin-alert-error-border)] bg-[var(--admin-alert-error-bg)] px-3 py-2">
              <p className="flex items-center gap-1.5 text-sm font-bold text-rose-700 dark:text-rose-300">
                <AlertTriangle size={15} className="shrink-0" />
                Revisá estos horarios
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {conflicts.map((c) => (
                  <li key={slotKey(c.courtId, c.time)} className="text-xs text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {c.courtName} · {c.time}
                    </span>{" "}
                    · {c.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!loading && grid && date ? (
            visibleCourts.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--text-tertiary)]">Elegí al menos una cancha.</p>
            ) : times.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--text-tertiary)]">
                Esas canchas no tienen turnos configurados para ese día.
              </p>
            ) : (
              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">3. Horarios</span>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setSelected(new Set(freeKeysOf(visibleCourts)))}
                      className="text-xs font-semibold text-[#0085FC]"
                    >
                      Seleccionar todos los disponibles
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelected(new Set())}
                      disabled={count === 0}
                      className="text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-40"
                    >
                      Limpiar selección
                    </button>
                  </div>
                </div>

                {/* Desktop: matriz cancha × horario. Cada celda es exactamente cancha + turno. */}
                <div className="mt-2 hidden overflow-x-auto rounded-xl border border-[var(--border-subtle)] sm:block">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[var(--bg-subtle)]">
                        <th className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-3 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]">
                          Cancha
                        </th>
                        {times.map((t) => (
                          <th key={t} className="px-1 py-1.5 text-center">
                            <button
                              type="button"
                              title={`Seleccionar ${t} en todas las canchas`}
                              onClick={() => toggleGroup(freeKeysOf(visibleCourts, t))}
                              className="rounded-lg px-2 py-1 text-xs font-bold text-[var(--text-primary)] hover:bg-[#0085FC]/10 hover:text-[#0085FC]"
                            >
                              {t}
                              <span className="block text-[10px] font-normal text-[var(--text-tertiary)]">
                                a {endByTime.get(t)}
                              </span>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCourts.map((court) => (
                        <tr key={court.id} className="border-t border-[var(--border-subtle)]">
                          <th className="sticky left-0 z-10 bg-[var(--bg-card)] px-3 py-2 text-left">
                            <span className="block whitespace-nowrap text-sm font-semibold text-[var(--text-primary)]">
                              {court.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleGroup(freeKeysOf([court]))}
                              className="whitespace-nowrap text-[11px] font-semibold text-[#0085FC]"
                            >
                              Toda la cancha
                            </button>
                          </th>
                          {times.map((t) => {
                            const slot = slotAt(court, t);
                            const key = slotKey(court.id, t);
                            if (!slot) {
                              return (
                                <td key={t} className="px-1 py-1.5 text-center text-xs text-[var(--text-tertiary)]">
                                  <span title="La cancha no tiene este turno ese día">—</span>
                                </td>
                              );
                            }
                            if (slot.occupied) {
                              return (
                                <td key={t} className="px-1 py-1.5 text-center">
                                  <span
                                    title={slot.detail}
                                    className={`mx-auto flex max-w-[92px] items-center justify-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-semibold ${
                                      conflictKeys.has(key)
                                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                        : "bg-[var(--bg-subtle)] text-[var(--text-tertiary)]"
                                    }`}
                                  >
                                    <Lock size={10} className="shrink-0" />
                                    <span className="truncate">{slot.detail}</span>
                                  </span>
                                </td>
                              );
                            }
                            return (
                              <td key={t} className="px-1 py-1.5 text-center">
                                <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-[#0085FC]/10">
                                  <input
                                    type="checkbox"
                                    checked={selected.has(key)}
                                    onChange={() => toggleKey(key)}
                                    aria-label={`${court.name} ${t}`}
                                    className="h-4 w-4 accent-[#0085FC]"
                                  />
                                </label>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: una tarjeta por cancha con sus turnos. */}
                <div className="mt-2 flex flex-col gap-3 sm:hidden">
                  {visibleCourts.map((court) => (
                    <div key={court.id} className="rounded-xl border border-[var(--border-subtle)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[var(--text-primary)]">{court.name}</p>
                        {court.slots.some((s) => !s.occupied) ? (
                          <button
                            type="button"
                            onClick={() => toggleGroup(freeKeysOf([court]))}
                            className="min-h-[44px] text-xs font-semibold text-[#0085FC]"
                          >
                            Toda la cancha
                          </button>
                        ) : null}
                      </div>
                      {court.slots.length === 0 ? (
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">Sin turnos ese día.</p>
                      ) : (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {court.slots.map((s) => {
                            const key = slotKey(court.id, s.time);
                            if (s.occupied) {
                              return (
                                <div
                                  key={s.time}
                                  className={`flex min-h-[44px] flex-col justify-center rounded-xl border px-3 py-1.5 ${
                                    conflictKeys.has(key)
                                      ? "border-rose-400/60 bg-rose-500/10"
                                      : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                                  }`}
                                >
                                  <span className="flex items-center gap-1 text-sm font-semibold text-[var(--text-tertiary)]">
                                    <Lock size={12} className="shrink-0" />
                                    {s.time}
                                  </span>
                                  <span className="truncate text-[11px] text-[var(--text-tertiary)]">{s.detail}</span>
                                </div>
                              );
                            }
                            const on = selected.has(key);
                            return (
                              <label
                                key={s.time}
                                className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                                  on
                                    ? "border-[#0085FC]/40 bg-[#0085FC]/10 text-[#0085FC]"
                                    : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => toggleKey(key)}
                                  className="h-4 w-4 accent-[#0085FC]"
                                />
                                <span>
                                  {s.time}
                                  <span className="block text-[10px] font-normal text-[var(--text-tertiary)]">
                                    a {s.endTime}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : null}

          <label className="mt-4 block">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">4. Motivo (opcional, para todo el lote)</span>
            <input
              type="text"
              value={note}
              maxLength={120}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Mantenimiento, evento privado..."
              className={`mt-1 ${inputClass}`}
            />
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={!date || count === 0 || saving || loading}
            className={`mt-5 ${adminCTAPrimary} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {saving
              ? "Bloqueando..."
              : count === 0
                ? "Elegí horarios para bloquear"
                : `Bloquear ${count} ${count === 1 ? "horario" : "horarios"}`}
          </button>
        </>
      )}
    </div>
  );
}

export default function BloqueosClient({
  courts,
  closedDays,
  blocks,
  todayYmd,
}: {
  courts: CourtOption[];
  closedDays: ClosedDayRow[];
  blocks: BlockRow[];
  todayYmd: string;
}) {
  const [panel, setPanel] = useState<Panel>("none");
  const [flash, setFlash] = useState<Flash>(null);
  const [pending, startTransition] = useTransition();

  function handleDone(next: Flash) {
    setFlash(next);
    if (next?.type === "success") setPanel("none");
  }

  function removeClosedDay(id: string) {
    const formData = new FormData();
    formData.set("closed_day_id", id);
    startTransition(async () => {
      const result = await removeClosedDayAction(formData);
      setFlash(result.ok ? { type: "success", message: result.message } : { type: "error", message: result.error });
    });
  }

  function removeBlock(id: string) {
    const formData = new FormData();
    formData.set("block_id", id);
    startTransition(async () => {
      const result = await removeManualBlockAction(formData);
      setFlash(result.ok ? { type: "success", message: result.message } : { type: "error", message: result.error });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        kicker="Gestión de juego"
        title="Bloqueos Temporales"
        subtitle="Gestioná cierres excepcionales del club y bloqueos puntuales de tus canchas."
      />

      {flash ? <AdminFlashMessage type={flash.type} message={flash.message} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setFlash(null);
            setPanel((p) => (p === "day" ? "none" : "day"));
          }}
          className={`${adminCard} ${adminPressable} flex flex-col gap-3 text-left transition hover:-translate-y-0.5`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0085FC]/10">
            <CalendarOff size={24} className="text-[#0085FC]" />
          </div>
          <div>
            <p className="font-bold text-[var(--text-primary)]">Cerrar día completo</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              Feriado, lluvia, mantenimiento o cualquier día en que el club no abre.
            </p>
          </div>
          <p className="mt-auto text-sm font-semibold text-[#0085FC]">
            {panel === "day" ? "Cerrar panel" : "Elegir fecha →"}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setFlash(null);
            setPanel((p) => (p === "slot" ? "none" : "slot"));
          }}
          className={`${adminCard} ${adminPressable} flex flex-col gap-3 text-left transition hover:-translate-y-0.5`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0085FC]/10">
            <Ban size={24} className="text-[#0085FC]" />
          </div>
          <div>
            <p className="font-bold text-[var(--text-primary)]">Bloquear horarios</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              Sacar uno o varios turnos de tus canchas sin cerrar el día entero.
            </p>
          </div>
          <p className="mt-auto text-sm font-semibold text-[#0085FC]">
            {panel === "slot" ? "Cerrar panel" : "Elegir horarios →"}
          </p>
        </button>
      </div>

      {panel === "day" ? <CloseDayPanel todayYmd={todayYmd} onDone={handleDone} /> : null}
      {panel === "slot" ? <BlockSlotPanel courts={courts} todayYmd={todayYmd} onDone={handleDone} /> : null}

      <div className={adminCard}>
        <p className={adminKicker}>Próximos días cerrados</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Reabrir un día devuelve la disponibilidad general. Lo que se canceló no se restaura.
        </p>
        {closedDays.length === 0 ? (
          <div className={`mt-4 ${adminEmptyState}`}>No hay días cerrados próximos.</div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {closedDays.map((day) => (
              <div
                key={day.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="text-sm font-semibold capitalize text-[var(--text-primary)]">
                    {formatDay(day.closed_date)}
                  </span>
                  {day.reason ? (
                    <span className="ml-2 text-xs text-[var(--text-tertiary)]">· {day.reason}</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeClosedDay(day.id)}
                  className={`${adminButtonGhost} px-3 py-1 text-[13px] disabled:opacity-40`}
                >
                  Reabrir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={adminCard}>
        <p className={adminKicker}>Horarios bloqueados</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Solo los bloqueos cargados desde acá. Entrenamientos y torneos se gestionan en su propia sección.
        </p>
        {blocks.length === 0 ? (
          <div className={`mt-4 ${adminEmptyState}`}>No hay horarios bloqueados próximos.</div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {Array.from(new Set(blocks.map((b) => b.blocked_date))).map((day) => {
              const dayBlocks = blocks.filter((b) => b.blocked_date === day);
              return (
                <div key={day}>
                  <p className="text-xs font-bold capitalize text-[var(--text-secondary)]">
                    {formatShortDay(day)} · {dayBlocks.length} {dayBlocks.length === 1 ? "bloqueo" : "bloqueos"}
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {dayBlocks.map((b) => (
                      <div
                        key={b.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {b.courtName} · {b.blocked_time} hs
                          </span>
                          {b.note ? (
                            <span className="ml-2 text-xs text-[var(--text-tertiary)]">· {b.note}</span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => removeBlock(b.id)}
                          className={`${adminCTADangerCompact} disabled:opacity-40`}
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
