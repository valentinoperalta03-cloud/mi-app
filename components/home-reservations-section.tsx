import Link from "next/link";
import { Calendar, Trophy } from "lucide-react";
import { fetchMyHomeReservations } from "@/lib/home-my-reservations";
import { createClient } from "@/utils/supabase/server";
import { HomeReservationLeaveForm } from "@/components/home-reservation-leave-form";

export async function HomeReservationsSection({ userId }: { userId: string }) {
  const supabase = await createClient();
  const list = await fetchMyHomeReservations(supabase, userId);

  if (list.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200/90 bg-white/80 px-4 py-6 text-center">
        <p className="text-sm text-slate-500">Aún no tenés partidos programados</p>
        <Link
          href="/buscar-partido"
          className="mt-4 inline-flex items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition"
          style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
        >
          Buscar Partido
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {list.map((r) => (
        <li key={r.matchId}>
          <article className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
            <div
              className="-mx-5 -mt-5 mb-4 h-1"
              style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
            />
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0585FC]/10 text-[#0461C4]">
                {r.matchTypeLabel === "Competitivo" ? (
                  <Trophy size={18} strokeWidth={2.1} aria-hidden />
                ) : (
                  <Calendar size={18} strokeWidth={2.1} aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm font-bold leading-tight text-slate-900">{r.clubName}</p>
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Fecha:</span> {r.dateLine}
                </p>
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Hora:</span> {r.timeLine}
                </p>
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Tipo:</span> {r.matchTypeLabel}
                </p>
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Jugadores:</span>{" "}
                  {r.slotsFilled}/4 confirmados
                </p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-[#0585FC] transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, (r.slotsFilled / 4) * 100))}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                  <Link
                    href={`/partidos/${r.matchId}`}
                    className="text-xs font-semibold text-[#0585FC] underline decoration-sky-200/80 underline-offset-2 hover:text-[#0461C4]"
                  >
                    Ver detalle
                  </Link>
                  <span className="text-slate-300" aria-hidden>
                    ·
                  </span>
                  <HomeReservationLeaveForm matchId={r.matchId} />
                </div>
              </div>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
