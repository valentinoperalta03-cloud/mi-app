"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  toggleMatchParticipationAction,
  type ToggleJoinState,
} from "@/app/(player)/buscar-partido/actions";

const initial: ToggleJoinState = { success: false, message: "" };

function LeaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs font-semibold text-slate-500 underline-offset-2 transition hover:text-rose-600 disabled:opacity-50"
    >
      {pending ? "Saliendo…" : "Salir"}
    </button>
  );
}

export function HomeReservationLeaveForm({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(toggleMatchParticipationAction, initial);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="intent" value="leave" />
      <LeaveButton />
    </form>
  );
}
