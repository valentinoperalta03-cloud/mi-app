"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  toggleCourtBlockAction,
  type BlockActionState,
} from "./actions";

const initialState: BlockActionState = { success: false, message: "" };

type SlotToggleFormProps = {
  courtId: string;
  date: string;
  startTime: string;
  status: "free" | "blocked" | "reserved";
};

function SubmitButton({ status }: { status: SlotToggleFormProps["status"] }) {
  const { pending } = useFormStatus();

  if (status === "reserved") {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-2xl border border-slate-200/90 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-400"
      >
        Reservado
      </button>
    );
  }

  const isBlocked = status === "blocked";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full rounded-2xl px-4 py-2.5 text-xs font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 ${
        isBlocked
          ? "border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50"
          : "bg-slate-900 text-white hover:bg-slate-800"
      }`}
    >
      {pending ? "Guardando..." : isBlocked ? "Liberar cancha" : "Bloquear turno"}
    </button>
  );
}

export default function SlotToggleForm({
  courtId,
  date,
  startTime,
  status,
}: SlotToggleFormProps) {
  const [state, formAction] = useActionState(toggleCourtBlockAction, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="court_id" value={courtId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="start_time" value={startTime} />
      <input type="hidden" name="mode" value={status === "blocked" ? "free" : "block"} />
      <SubmitButton status={status} />
      {state.message && !state.success ? (
        <p className="rounded-xl border border-rose-200/80 bg-rose-50/90 px-2.5 py-1.5 text-[11px] font-medium text-rose-800">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
