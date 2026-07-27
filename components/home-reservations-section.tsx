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
          style={{ background: "linear-gradient(135deg, #0085FC 0%, #0461C4 100%)" }}
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
              style={{ background: "#CCFF00" }}
            />
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0085FC]/10 text-[#0461C4]">
                {r.matchTypeLabel === "Competitivo" ? (
                  <Trophy size={18} strokeWidth={2.1} aria-hidden />
                ) : (
                  <Calendar size={18} strokeWidth={2.1} aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-base font-bold text-[var(--text-primary)]">{r.clubName}</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {r.dateLine} · {r.timeLine}
                </p>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    background: r.matchTypeLabel === "Competitivo" ? "rgba(5,133,252,0.1)" : "rgba(204,255,0,0.15)",
                    color: r.matchTypeLabel === "Competitivo" ? "#0085FC" : "#5a7a00",
                  }}
                >
                  {r.matchTypeLabel}
                </span>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">
                      {r.slotsFilled}/4 jugadores
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">
                      {r.slotsFilled === 4 ? "Completo" : `${4 - r.slotsFilled} lugares libres`}
                    </p>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, (r.slotsFilled / 4) * 100))}%`,
                        background: r.slotsFilled === 4 ? "#CCFF00" : "linear-gradient(90deg, #0085FC, #0461C4)",
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                  <Link
                    href={`/partidos/${r.matchId}`}
                    className="text-xs font-semibold text-[#0085FC] underline decoration-sky-200/80 underline-offset-2 hover:text-[#0461C4]"
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
