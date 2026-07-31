"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function CancelMeetingButton({ meetingId, clubName }: { meetingId: string; clubName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm(`¿Cancelar la reunión con "${clubName}"? Se cancela el evento en Google Calendar y se avisa por email.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/meetings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo cancelar.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
      >
        {isPending ? "Cancelando..." : "Cancelar"}
      </button>
      {error ? <p className="text-[10px] text-rose-300">{error}</p> : null}
    </div>
  );
}
