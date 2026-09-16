"use client";

import { useCallback, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Ban, CalendarOff, CheckCircle2, Info } from "lucide-react";
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
  createManualBlockAction,
  getSlotOptionsAction,
  previewDayAction,
  removeClosedDayAction,
  removeManualBlockAction,
  type ActivityGroup,
  type DayPreview,
  type SlotOption,
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

function BlockSlotPanel({
  courts,
  todayYmd,
  onDone,
}: {
  courts: CourtOption[];
  todayYmd: string;
  onDone: (f: Flash) => void;
}) {
  const [courtId, setCourtId] = useState(courts[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [slotError, setSlotError] = useState("");
  const [dayClosed, setDayClosed] = useState(false);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  const loadSlots = useCallback((nextCourtId: string, nextDate: string) => {
    setTime("");
    if (!nextCourtId || !nextDate) {
      setSlots(null);
      setSlotError("");
      setDayClosed(false);
      return;
    }
    startLoading(async () => {
      const result = await getSlotOptionsAction(nextCourtId, nextDate);
      if (result.ok) {
        setSlots(result.slots);
        setDayClosed(result.dayClosed);
        setSlotError("");
      } else {
        setSlots(null);
        setDayClosed(false);
        setSlotError(result.error);
      }
    });
  }, []);

  function submit() {
    const formData = new FormData();
    formData.set("court_id", courtId);
    formData.set("blocked_date", date);
    formData.set("blocked_time", time);
    formData.set("note", note);
    startSaving(async () => {
      const result = await createManualBlockAction(formData);
      if (result.ok) {
        setTime("");
        setNote("");
        setSlots(null);
        setDate("");
        onDone({ type: "success", message: result.message });
      } else {
        onDone({ type: "error", message: result.error });
      }
    });
  }

  const freeSlots = slots?.filter((s) => !s.occupied) ?? [];
  const busySlots = slots?.filter((s) => s.occupied) ?? [];

  return (
    <div className={adminCard}>
      <p className={adminKicker}>Bloquear horario</p>
      <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">Sacá un turno puntual de circulación</p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Solo se pueden bloquear turnos libres. Si el horario ya tiene algo agendado, resolvelo en su sección primero.
      </p>

      {courts.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--text-tertiary)]">Todavía no tenés canchas cargadas.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Cancha</span>
              <select
                value={courtId}
                onChange={(e) => {
                  setCourtId(e.target.value);
                  loadSlots(e.target.value, date);
                }}
                className={`mt-1 ${inputClass}`}
              >
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Fecha</span>
              <input
                type="date"
                value={date}
                min={todayYmd}
                onChange={(e) => {
                  setDate(e.target.value);
                  loadSlots(courtId, e.target.value);
                }}
                className={`mt-1 ${inputClass}`}
              />
            </label>
          </div>

          {slotError ? <p className="mt-3 text-sm text-rose-600">{slotError}</p> : null}
          {loading ? <p className="mt-3 text-sm text-[var(--text-tertiary)]">Buscando los turnos de esa cancha...</p> : null}

          {!loading && dayClosed ? (
            <p className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
              Ese día el club ya está cerrado. El bloqueo se guarda igual y sigue valiendo si después reabrís la fecha.
            </p>
          ) : null}

          {!loading && slots ? (
            slots.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-tertiary)]">
                Esa cancha no tiene turnos configurados para ese día.
              </p>
            ) : (
              <div className="mt-4">
                <p className={adminSectionLabel}>Turnos libres</p>
                {freeSlots.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--text-tertiary)]">
                    No queda ningún turno libre en esa cancha ese día.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {freeSlots.map((s) => (
                      <button
                        key={s.time}
                        type="button"
                        onClick={() => setTime(s.time)}
                        className={`rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
                          time === s.time
                            ? "border-[#0085FC]/30 bg-[#0085FC]/10 text-[#0085FC]"
                            : "border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                        }`}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                )}

                {busySlots.length > 0 ? (
                  <details className="mt-3 rounded-xl border border-[var(--border-subtle)] px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-[var(--text-secondary)]">
                      Turnos ocupados ({busySlots.length})
                    </summary>
                    <ul className="mt-2 flex flex-col gap-1">
                      {busySlots.map((s) => (
                        <li key={s.time} className="text-xs text-[var(--text-secondary)]">
                          <span className="font-semibold text-[var(--text-primary)]">{s.time}</span>
                          <span className="text-[var(--text-tertiary)]"> · {s.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            )
          ) : null}

          <label className="mt-4 block">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Motivo (opcional)</span>
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
            disabled={!courtId || !date || !time || saving}
            className={`mt-5 ${adminCTAPrimary} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {saving ? "Bloqueando..." : "Bloquear horario"}
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
            <p className="font-bold text-[var(--text-primary)]">Bloquear horario</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              Sacar un turno puntual de una cancha sin cerrar el día entero.
            </p>
          </div>
          <p className="mt-auto text-sm font-semibold text-[#0085FC]">
            {panel === "slot" ? "Cerrar panel" : "Elegir horario →"}
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
          <div className="mt-4 flex flex-col gap-2">
            {blocks.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {b.courtName} · {b.blocked_time} hs
                  </span>
                  <span className="ml-2 text-xs capitalize text-[var(--text-tertiary)]">
                    {formatShortDay(b.blocked_date)}
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
        )}
      </div>
    </div>
  );
}
