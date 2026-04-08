"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createCourtAction,
  type ActionState,
  upsertCourtScheduleAction,
} from "./actions";

const initialState: ActionState = { success: false, message: "" };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-60"
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;

  return (
    <p
      className={`rounded-2xl border px-3 py-2 text-xs ${
        state.success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {state.message}
    </p>
  );
}

export function CreateCourtForm({ clubId }: { clubId: string }) {
  const [state, formAction] = useActionState(createCourtAction, initialState);

  return (
    <form action={formAction} className="space-y-2 rounded-2xl border border-slate-100 p-4">
      <input type="hidden" name="club_id" value={clubId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          name="name"
          placeholder="Nombre de cancha"
          required
          className="rounded-2xl border border-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
        />
        <input
          name="price"
          type="number"
          step="0.01"
          min="0"
          placeholder="Precio"
          required
          className="rounded-2xl border border-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <FormMessage state={state} />
        <SubmitButton label="Agregar cancha" />
      </div>
    </form>
  );
}

type ScheduleFormProps = {
  courtId: string;
  dayOfWeek: number;
  openTime?: string | null;
  closeTime?: string | null;
};

export function ScheduleForm({
  courtId,
  dayOfWeek,
  openTime,
  closeTime,
}: ScheduleFormProps) {
  const [state, formAction] = useActionState(upsertCourtScheduleAction, initialState);

  return (
    <form
      action={formAction}
      className="grid items-center gap-2 rounded-2xl border border-slate-100 p-3 sm:grid-cols-[1fr_1fr_auto]"
    >
      <input type="hidden" name="court_id" value={courtId} />
      <input type="hidden" name="day_of_week" value={dayOfWeek} />
      <input
        name="open_time"
        type="time"
        defaultValue={openTime ?? ""}
        required
        className="rounded-2xl border border-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
      />
      <input
        name="close_time"
        type="time"
        defaultValue={closeTime ?? ""}
        required
        className="rounded-2xl border border-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
      />
      <SubmitButton label="Guardar" />
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
