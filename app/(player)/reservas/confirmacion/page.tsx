import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { DB_TABLES } from "@/lib/db-tables";
import { PLAYER_CARD, PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";

type PageProps = {
  searchParams: Promise<{
    id?: string;
    court?: string;
    club?: string;
  }>;
};

export default async function ConfirmacionReservaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const id = params.id?.trim();
  if (!id) {
    redirect("/reservas");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: row, error } = await supabase.from(DB_TABLES.matches).select("*").eq("id", id).maybeSingle();

  if (error || !row) {
    notFound();
  }

  const match = row as {
    owner_id: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    duration_minutes: number | null;
    match_type: string | null;
  };

  if (match.owner_id !== user.id || match.match_type !== "reservation") {
    notFound();
  }

  const courtLabel = params.court ?? "Cancha";
  const clubLabel = params.club ?? "Club";
  const dateStr = match.scheduled_date ?? "";
  const timeStr = (match.scheduled_time ?? "").toString().trim().slice(0, 5);
  const duration = match.duration_minutes ?? 90;

  const fechaFormateada =
    dateStr.length >= 10
      ? format(parseISO(`${dateStr}T12:00:00`), "EEEE d 'de' MMMM yyyy", { locale: es })
      : "—";

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      <div className="flex flex-col items-center gap-3 pt-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700 shadow-inner">
          ✓
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-slate-950">¡Reserva confirmada!</h1>
      </div>

      <section className={`${PLAYER_CARD} space-y-3 p-5`}>
        <div className="flex justify-between gap-2 text-sm">
          <span className="font-medium text-slate-500">Club</span>
          <span className="font-semibold text-slate-900">{clubLabel}</span>
        </div>
        <div className="flex justify-between gap-2 text-sm">
          <span className="font-medium text-slate-500">Cancha</span>
          <span className="font-semibold text-slate-900">{courtLabel}</span>
        </div>
        <div className="flex justify-between gap-2 text-sm">
          <span className="font-medium text-slate-500">Fecha</span>
          <span className="font-semibold capitalize text-slate-900">{fechaFormateada}</span>
        </div>
        <div className="flex justify-between gap-2 text-sm">
          <span className="font-medium text-slate-500">Hora</span>
          <span className="font-semibold text-slate-900">{timeStr || "—"}</span>
        </div>
        <div className="flex justify-between gap-2 text-sm">
          <span className="font-medium text-slate-500">Duración</span>
          <span className="font-semibold text-slate-900">{duration} min</span>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <Link href="/reservas" className={`inline-flex justify-center ${PLAYER_PRIMARY_BUTTON} py-3.5 text-base`}>
          Ver mis reservas
        </Link>
        <Link
          href="/home"
          className="inline-flex justify-center rounded-2xl py-3 text-center text-sm font-semibold text-sky-600 transition hover:bg-sky-50"
        >
          Volver al inicio
        </Link>
      </div>
    </MotionPage>
  );
}
