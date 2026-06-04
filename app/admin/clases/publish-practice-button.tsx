"use client";

import { useTransition, useState } from "react";
import { publishPracticeAction, cancelPracticeAction } from "./[id]/actions";

export function PublishPracticeButton({ practiceId }: { practiceId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div>
      {msg ? <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">{msg}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await publishPracticeAction(practiceId);
            setMsg(res.message);
          })
        }
        className="rounded-2xl bg-[#0461C4] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Publicando…" : "Publicar clase"}
      </button>
    </div>
  );
}

export function CancelPracticeButton({ practiceId }: { practiceId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void cancelPracticeAction(practiceId))}
      className="rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 dark:border-rose-900 dark:text-rose-300"
    >
      Cancelar clase
    </button>
  );
}
