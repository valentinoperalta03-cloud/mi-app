"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  upsertCourtScheduleAction,
  type ScheduleActionState,
} from "./actions";

const initialState: ScheduleActionState = { success: false, message: "" };

type ScheduleRow = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
};

type ScheduleGridProps = {
  selectedCourtId: string;
  rows: ScheduleRow[];
  dayLabels: string[];
};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Guardar"}
    </button>
  );
}

function DayScheduleForm({
  courtId,
  dayLabel,
  dayOfWeek,
  openTime,
  closeTime,
}: {
  courtId: string;
  dayLabel: string;
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
}) {
  const [state, formAction] = useActionState(upsertCourtScheduleAction, initialState);

  return (
    <form
      action={formAction}
      className="grid items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-3 sm:grid-cols-[140px_1fr_1fr_auto]"
    >
      <input type="hidden" name="court_id" value={courtId} />
      <input type="hidden" name="day_of_week" value={dayOfWeek} />

      <p className="text-sm font-medium text-slate-800">{dayLabel}</p>

      <input
        name="open_time"
        type="time"
        defaultValue={openTime ?? "09:00"}
        required
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
      />
      <input
        name="close_time"
        type="time"
        defaultValue={closeTime ?? "21:00"}
        required
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
      />
      <SaveButton />

      {state.message ? (
        <p
          className={`sm:col-span-4 rounded-xl border px-3 py-2 text-xs ${
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export default function ScheduleGrid({
  selectedCourtId,
  rows,
  dayLabels,
}: ScheduleGridProps) {
  return (
    <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
      <div className="hidden px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[140px_1fr_1fr_auto]">
        <span>Dia</span>
        <span>Apertura</span>
        <span>Cierre</span>
        <span className="text-right">Accion</span>
      </div>

      {rows.map((row) => (
        <DayScheduleForm
          key={`${selectedCourtId}-${row.day_of_week}`}
          courtId={selectedCourtId}
          dayLabel={dayLabels[row.day_of_week]}
          dayOfWeek={row.day_of_week}
          openTime={row.open_time}
          closeTime={row.close_time}
        />
      ))}
    </section>
  );
}
