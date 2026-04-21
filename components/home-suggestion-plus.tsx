"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setUserFavorite } from "@/app/(player)/jugador/[userId]/actions";

export function HomeSuggestionPlus({ targetUserId }: { targetUserId: string }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function click() {
    setErr(null);
    startTransition(async () => {
      const r = await setUserFavorite(targetUserId, true);
      if (!r.ok) {
        setErr(r.message);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return <span className="text-[11px] font-semibold text-emerald-600">En favoritos</span>;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => click()}
        aria-label="Agregar a favoritos"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/90 bg-white text-lg font-light leading-none text-slate-500 shadow-sm transition hover:border-[#0585FC]/30 hover:bg-[#0585FC]/5 hover:text-[#0461C4] disabled:opacity-50"
      >
        +
      </button>
      {err ? (
        <span className="max-w-[8rem] text-center text-[10px] text-rose-600">{err}</span>
      ) : null}
    </div>
  );
}
