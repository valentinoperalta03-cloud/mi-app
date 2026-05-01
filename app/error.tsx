"use client";

import Link from "next/link";
import Image from "next/image";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-8">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0585FC] via-white to-slate-50" />
      <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-[#0585FC]/10 blur-3xl" />
      <div className="absolute -right-20 bottom-12 h-64 w-64 rounded-full bg-[#0585FC]/10 blur-3xl" />

      <section className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-slate-200/70 bg-white/90 p-8 text-center shadow-[0_20px_60px_-28px_rgba(15,23,42,0.28)] backdrop-blur-[2px] sm:p-10">
        <div className="mx-auto mb-6">
          <div className="relative h-14 w-40 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90">
            <Image src="/logo.png" alt="Logo de Padelibre" fill className="object-contain p-2" />
          </div>
        </div>

        <div className="mx-auto mb-7 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-[#0585FC]/5 text-[#0585FC] ring-1 ring-[#0585FC]/20/80">
          <AlertTriangle size={34} strokeWidth={2.1} aria-hidden />
        </div>

        <svg
          width="74"
          height="74"
          viewBox="0 0 74 74"
          fill="none"
          aria-hidden
          className="mx-auto mb-6 opacity-70"
        >
          <circle cx="37" cy="37" r="34" stroke="#0C4A6E" strokeWidth="2" />
          <path d="M12 26 C24 18, 50 18, 62 26" stroke="#0284C7" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M14 37 L60 37" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
          <path d="M20 48 C28 43, 46 43, 54 48" stroke="#0284C7" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M33 21 L41 53" stroke="#0C4A6E" strokeWidth="1.7" strokeLinecap="round" strokeDasharray="3 4" />
        </svg>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0461C4]">Error</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Algo salió mal</h1>
          <p className="mx-auto max-w-sm text-sm font-medium leading-relaxed text-slate-600">
            Hubo un error inesperado en la cancha. No te preocupes, podemos intentar de nuevo.
          </p>
        </div>

        <div className="mt-8 flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-2xl bg-[color:var(--color-brand-mid)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[color:var(--color-brand-light)] active:scale-[0.98]"
          >
            Reintentar
          </button>
          <Link
            href="/home"
            className="w-full rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
          >
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
