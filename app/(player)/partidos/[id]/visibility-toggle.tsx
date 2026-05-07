"use client";

import { useState, useTransition } from "react";
import { AppleToast } from "@/components/apple-toast";
import { toggleMatchVisibility } from "./actions";

export default function VisibilityToggle({
  matchId,
  initialVisibility,
}: {
  matchId: string;
  initialVisibility: "publico" | "privado";
}) {
  const [visibility, setVisibility] = useState<"publico" | "privado">(initialVisibility);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  }

  function onToggle() {
    const next = visibility === "publico" ? "privado" : "publico";
    startTransition(async () => {
      const res = await toggleMatchVisibility(matchId, next);
      if (!res.ok) {
        showToast(res.message);
        return;
      }
      setVisibility(next);
      showToast(next === "privado" ? "Visibilidad cambiada a privado" : "Visibilidad cambiada a público");
    });
  }

  return (
    <>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-3 py-2">
        <span className="text-sm font-medium text-[var(--text-secondary)]">Privado</span>
        <button
          type="button"
          onClick={onToggle}
          disabled={pending}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
            visibility === "publico" ? "bg-[#0585FC]" : "bg-slate-300"
          } disabled:opacity-60`}
          aria-label="Cambiar visibilidad"
          aria-pressed={visibility === "privado"}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
              visibility === "publico" ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <AppleToast message={toast} />
    </>
  );
}
