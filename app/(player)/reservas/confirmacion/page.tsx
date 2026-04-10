import Link from "next/link";
import MotionPage from "@/components/motion-page";
import { PLAYER_CARD, PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";

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
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">Confirmacion de reserva</h1>

      <section className={`${PLAYER_CARD} space-y-2 p-5`}>
        <p className="text-sm font-light text-slate-500">Club ID: {clubId}</p>
        <p className="text-sm font-light text-slate-500">Cancha: {court}</p>
        <p className="text-sm font-light text-slate-500">Fecha: {date}</p>
        <p className="text-sm font-light text-slate-500">Horario: {time}</p>
        <p className="text-sm font-light text-slate-500">Duracion: {duration} min</p>
      </section>

      <Link
        href="/reservas"
        className={`inline-block ${PLAYER_PRIMARY_BUTTON}`}
      >
        Volver a reservas
      </Link>
    </MotionPage>
  );
}

