"use client";

import { useEffect, useState } from "react";

const SLOW_TIMEOUT_MS = 8000;

/** Feedback mientras se genera la preferencia de Mercado Pago (redirect en curso). */
export function MpLoadingNotice() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="sticky bottom-0 left-0 right-0 -mx-4 border-t border-slate-100 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      {slow ? (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-center text-sm font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          Esto está tardando más de lo usual. ¿Querés reintentar?
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-slate-100 px-4 py-3.5 dark:bg-slate-800">
          <span className="h-4 w-4 animate-pulse rounded-full bg-[#0585FC]" aria-hidden />
          <span className="animate-pulse text-sm font-semibold text-slate-600 dark:text-slate-300">
            Generando el link de pago con Mercado Pago…
          </span>
        </div>
      )}
    </div>
  );
}
