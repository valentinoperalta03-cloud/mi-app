import Link from "next/link";
import { GraduationCap } from "lucide-react";
import MotionPage from "@/components/motion-page";

export default function ClasesPage() {
  return (
    <MotionPage className="mx-auto flex min-h-screen w-full max-w-md items-center bg-[var(--bg-app)] px-4 pb-24 pt-6">
      <article className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
          <GraduationCap className="h-10 w-10" />
        </div>
        <span className="mt-5 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
          En desarrollo
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--text-primary)]">Próximamente</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-tertiary)]">
          Pronto podrás reservar clases con profesores de tu club favorito
        </p>
        <Link
          href="/home"
          className="btn-primary-gradient mt-7 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition hover:brightness-95"
        >
          Volver al inicio
        </Link>
      </article>
    </MotionPage>
  );
}
