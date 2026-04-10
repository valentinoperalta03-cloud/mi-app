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
  status: "free" | "blocked" | "match";
};

function SubmitButton({ status }: { status: SlotToggleFormProps["status"] }) {
  const { pending } = useFormStatus();

  if (status === "match") {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-400"
      >
        PARTIDO ABIERTO
      </button>
    );
  }

  const isBlocked = status === "blocked";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full rounded-2xl px-4 py-2 text-xs font-semibold transition-all duration-300 disabled:opacity-60 ${
        isBlocked
          ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:opacity-95"
      }`}
    >
      {pending ? "Guardando..." : isBlocked ? "Liberar" : "Bloquear"}
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
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
