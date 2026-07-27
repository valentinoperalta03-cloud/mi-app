"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AppleToast } from "@/components/apple-toast";
import { isMatchPrivate, type MatchVisibility } from "@/lib/match-visibility";
import { toggleMatchVisibility } from "./actions";

export default function VisibilityToggle({
  matchId,
  initialVisibility,
}: {
  matchId: string;
  initialVisibility: MatchVisibility;
}) {
  const router = useRouter();
  const [visibility, setVisibility] = useState<MatchVisibility>(initialVisibility);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isPrivate = isMatchPrivate(visibility);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  }

  function onToggle() {
    const next: MatchVisibility = isPrivate ? "publico" : "privado";
    startTransition(async () => {
      const res = await toggleMatchVisibility(matchId, next);
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      setVisibility(next);
      showToast(next === "privado" ? "Partido privado" : "Partido público");
      router.refresh();
    });
  }

  return (
    <>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-subtle)] px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {isPrivate ? "Privado" : "Público"}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {isPrivate ? "Solo amigos y quienes invites" : "Visible en Buscar partido"}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          disabled={pending}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
            isPrivate ? "bg-[#0085FC]" : "bg-slate-300"
          } disabled:opacity-60`}
          aria-label={isPrivate ? "Cambiar a público" : "Cambiar a privado"}
          aria-pressed={isPrivate}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
              isPrivate ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <AppleToast message={toast} />
    </>
  );
}
