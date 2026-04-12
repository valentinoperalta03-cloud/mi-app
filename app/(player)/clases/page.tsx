import Link from "next/link";
import MotionPage from "@/components/motion-page";

export default function ClasesPage() {
  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-slate-50 px-4 pb-32 pt-6">
      <Link href="/home" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
        ← Inicio
      </Link>
      <article className="rounded-[2rem] border border-slate-200/80 bg-white p-8 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clases</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Acá vas a poder reservar clases y entrenamientos. Estamos trabajando en esta sección.
        </p>
      </article>
    </MotionPage>
  );
}
