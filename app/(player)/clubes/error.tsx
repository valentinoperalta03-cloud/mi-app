"use client";

import { useEffect } from "react";
import MotionPage from "@/components/motion-page";

export default function ClubesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[clubes] error boundary", error);
  }, [error]);

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-transparent px-4 pb-24 pt-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Algo salió mal</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">No se pudo mostrar la página de clubes.</p>
      <pre className="max-h-48 overflow-auto rounded-xl bg-slate-100 p-3 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200">
        {error.message}
      </pre>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-2xl bg-[#0585FC] px-4 py-3 text-sm font-semibold text-white"
      >
        Reintentar
      </button>
    </MotionPage>
  );
}
