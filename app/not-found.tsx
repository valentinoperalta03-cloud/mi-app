import Link from "next/link";
import Image from "next/image";
import { CircleDot } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-8">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-sky-50 via-white to-slate-50" />
      <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="absolute -right-20 bottom-12 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl" />

      <section className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-slate-200/70 bg-white/90 p-8 text-center shadow-[0_20px_60px_-28px_rgba(15,23,42,0.28)] backdrop-blur-[2px] sm:p-10">
        <div className="mx-auto mb-6">
          <div className="relative h-14 w-40 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90">
            <Image src="/logo-marca.png" alt="Logo de Padelibre" fill className="object-contain p-2" />
          </div>
        </div>

        <div className="mx-auto mb-7 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-sky-50 text-sky-800 ring-1 ring-sky-200/80">
          <CircleDot size={34} strokeWidth={2.1} aria-hidden />
        </div>

        <svg
          width="74"
          height="74"
          viewBox="0 0 74 74"
          fill="none"
          aria-hidden
          className="mx-auto mb-6 opacity-80"
        >
          <circle cx="37" cy="37" r="34" stroke="#0369A1" strokeWidth="2" />
          <path d="M12 29 Q37 24 62 29" stroke="#0EA5E9" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M10 37 Q37 32 64 37" stroke="#0EA5E9" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M12 45 Q37 40 62 45" stroke="#0EA5E9" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Error 404</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Esta página no existe</h1>
          <p className="mx-auto max-w-sm text-sm font-medium leading-relaxed text-slate-600">
            Parece que la página que buscás se tomó un descanso. ¡Volvamos a la cancha!
          </p>
        </div>

        <Link
          href="/home"
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-[color:var(--color-brand-mid)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[color:var(--color-brand-light)] active:scale-[0.98]"
        >
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
