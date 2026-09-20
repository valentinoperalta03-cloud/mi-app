"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/**
 * Refresh explícito (sección 16): además del Realtime automático
 * (TournamentRealtimeRefresh), el jugador puede forzar una actualización y
 * ver un estado de carga. La página ya usa `force-dynamic`, así que
 * router.refresh() siempre trae datos frescos del server, nunca cacheados.
 */
export function TournamentRefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [justRefreshed, setJustRefreshed] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setJustRefreshed(false);
        startTransition(() => {
          router.refresh();
          setJustRefreshed(true);
        });
      }}
      className={
        className ??
        "flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-60"
      }
    >
      <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
      {pending ? "Actualizando…" : justRefreshed ? "Actualizado ✓" : "Actualizar resultados"}
    </button>
  );
}
