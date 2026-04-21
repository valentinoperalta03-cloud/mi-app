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
      className="w-full rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
      className="flex flex-col gap-3 rounded-2xl border border-slate-100/90 bg-gradient-to-br from-white to-slate-50/40 p-4 shadow-sm sm:grid sm:grid-cols-[minmax(0,7rem)_1fr_1fr_auto] sm:items-center sm:gap-3 sm:p-3.5"
    >
      <input type="hidden" name="court_id" value={courtId} />
      <input type="hidden" name="day_of_week" value={dayOfWeek} />

      <p className="text-sm font-semibold text-slate-900">{dayLabel}</p>

      <label className="grid gap-1 sm:block">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 sm:sr-only">
          Apertura
        </span>
        <input
          name="open_time"
          type="time"
          defaultValue={openTime ?? "09:00"}
          required
          className="w-full min-w-0 rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20/50"
        />
      </label>
      <label className="grid gap-1 sm:block">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 sm:sr-only">
          Cierre
        </span>
        <input
          name="close_time"
          type="time"
          defaultValue={closeTime ?? "21:00"}
          required
          className="w-full min-w-0 rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20/50"
        />
      </label>
      <div className="sm:justify-self-end">
        <SaveButton />
      </div>

      {state.message ? (
        <p
          className={`w-full rounded-xl border px-3 py-2 text-xs font-medium sm:col-span-4 ${
            state.success
              ? "border-emerald-200/80 bg-emerald-50/90 text-emerald-800"
              : "border-rose-200/80 bg-rose-50/90 text-rose-800"
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
    <div className="space-y-3 border-t border-slate-100/90 pt-5">
      <div className="hidden px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:grid sm:grid-cols-[140px_1fr_1fr_auto] sm:gap-3">
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
    </div>
  );
}
