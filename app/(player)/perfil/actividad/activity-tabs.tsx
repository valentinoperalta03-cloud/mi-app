"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarX2, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type MatchActivity = {
  id: string;
  scheduled_date: string | null;
  match_type: string | null;
  match_status: string | null;
  club_name: string;
};

type ReservationActivity = {
  id: string;
  scheduled_date: string | null;
  match_status: string | null;
  court_name: string;
  total_price: number | null;
};

function formatDate(input: string | null) {
  if (!input || input.length < 10) return "—";
  return format(parseISO(`${input}T12:00:00`), "EEE d MMM yyyy", { locale: es });
}

function translateStatus(status: string | null): string {
  const map: Record<string, string> = {
    scheduled: "Programado",
    reserved: "Reservado",
    cancelled: "Cancelado",
    finished: "Finalizado",
    paid: "Pagado",
    pending: "Pendiente",
    refunded: "Reembolsado",
    rejected: "Rechazado",
    approved: "Aprobado",
  };
  return map[status ?? ""] ?? status ?? "—";
}

function translateType(type: string | null): string {
  const map: Record<string, string> = {
    competitivo: "Competitivo",
    amistoso: "Amistoso",
    reservation: "Reserva de cancha",
  };
  return map[type ?? ""] ?? type ?? "—";
}

export default function ActivityTabs({
  matches,
  reservations,
}: {
  matches: MatchActivity[];
  reservations: ReservationActivity[];
}) {
  const [tab, setTab] = useState<"partidos" | "reservas" | "torneos">("partidos");
  const money = useMemo(
    () => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }),
    []
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-transparent px-4 pb-24 pt-6">
      <header className="space-y-1 rounded-2xl bg-gradient-to-r from-[#0085FC] to-cyan-500 px-4 py-4 text-white">
        <p className="text-xs uppercase tracking-widest text-sky-100">Perfil</p>
        <h1 className="text-xl font-semibold leading-tight tracking-tight">Tu actividad</h1>
      </header>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setTab("partidos")}
          className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
            tab === "partidos" ? "bg-[#0085FC] text-white dark:bg-sky-500" : "text-slate-600 dark:text-slate-300"
          }`}
        >
          Partidos
        </button>
        <button
          type="button"
          onClick={() => setTab("reservas")}
          className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
            tab === "reservas" ? "bg-[#0085FC] text-white dark:bg-sky-500" : "text-slate-600 dark:text-slate-300"
          }`}
        >
          Reservas
        </button>
        <button
          type="button"
          onClick={() => setTab("torneos")}
          className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
            tab === "torneos" ? "bg-[#0085FC] text-white dark:bg-sky-500" : "text-slate-600 dark:text-slate-300"
          }`}
        >
          Torneos
        </button>
      </div>

      {tab === "partidos" ? (
        <section className="space-y-2">
          {matches.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800">
              <EmptyState
                icon={CalendarX2}
                title="Aún no tenés partidos"
                description="Cuando juegues tus primeros encuentros, van a aparecer acá."
              />
            </div>
          ) : (
            matches.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold capitalize text-slate-900">{formatDate(item.scheduled_date)}</p>
                  <Badge variant="neutral" className="shrink-0">
                    {translateStatus(item.match_status)}
                  </Badge>
                </div>
                <p className="mt-2 truncate text-sm text-slate-700">Club: {item.club_name}</p>
                <p className="text-sm text-slate-700">Tipo: {translateType(item.match_type)}</p>
              </article>
            ))
          )}
        </section>
      ) : null}

      {tab === "reservas" ? (
        <section className="space-y-2">
          {reservations.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800">
              <EmptyState
                icon={CalendarX2}
                title="Aún no tenés reservas"
                description="Tus reservas de cancha se van a listar en esta sección."
              />
            </div>
          ) : (
            reservations.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold capitalize text-slate-900">{formatDate(item.scheduled_date)}</p>
                  <Badge variant="neutral" className="shrink-0">
                    {translateStatus(item.match_status)}
                  </Badge>
                </div>
                <p className="mt-2 truncate text-sm text-slate-700">Cancha: {item.court_name}</p>
                <p className="text-sm text-slate-700">
                  Precio: {item.total_price != null ? money.format(item.total_price) : "—"}
                </p>
              </article>
            ))
          )}
        </section>
      ) : null}

      {tab === "torneos" ? (
        <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800">
          <EmptyState
            icon={Trophy}
            title="Torneos próximamente"
            description="Muy pronto vas a poder seguir tus torneos desde este módulo."
          />
        </section>
      ) : null}
    </main>
  );
}
