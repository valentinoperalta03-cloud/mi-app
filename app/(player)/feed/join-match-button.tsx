"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { joinMatchAction, type JoinMatchActionState } from "./actions";

const initialState: JoinMatchActionState = { success: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${PLAYER_PRIMARY_BUTTON} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? "Uniendote..." : "Unirse"}
    </button>
  );
}

type JoinMatchButtonProps = {
  matchId: string;
  userId: string;
};

export default function JoinMatchButton({ matchId, userId }: JoinMatchButtonProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(joinMatchAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={formAction}>
        <input type="hidden" name="match_id" value={matchId} />
        <input type="hidden" name="user_id" value={userId} />
        <SubmitButton />
      </form>

      {state.message ? (
        <p
          className={`rounded-xl border px-3 py-1 text-xs ${
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
          role="status"
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
