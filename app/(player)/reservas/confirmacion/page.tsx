import Link from "next/link";
import MotionPage from "@/components/motion-page";

type ConfirmacionPageProps = {
  searchParams: Promise<{
    clubId?: string;
    court?: string;
    time?: string;
    duration?: string;
    date?: string;
  }>;
};

export default async function ConfirmacionPage({ searchParams }: ConfirmacionPageProps) {
  const params = await searchParams;
  const court = params.court ?? "Sin cancha";
  const time = params.time ?? "--:--";
  const duration = params.duration ?? "-";
  const date = params.date ?? "Sin fecha";
  const clubId = params.clubId ?? "-";

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-transparent px-4 pb-24 pt-6">
      <h1 className="text-2xl font-bold text-slate-900">Confirmacion de reserva</h1>

      <section className="space-y-2 rounded-2xl border border-slate-100 bg-white/95 p-5 shadow-sm">
        <p className="text-sm text-slate-500">Club ID: {clubId}</p>
        <p className="text-sm text-slate-500">Cancha: {court}</p>
        <p className="text-sm text-slate-500">Fecha: {date}</p>
        <p className="text-sm text-slate-500">Horario: {time}</p>
        <p className="text-sm text-slate-500">Duracion: {duration} min</p>
      </section>

      <Link
        href="/reservas"
        className="inline-block rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:opacity-95 active:scale-95"
      >
        Volver a reservas
      </Link>
    </MotionPage>
  );
}

