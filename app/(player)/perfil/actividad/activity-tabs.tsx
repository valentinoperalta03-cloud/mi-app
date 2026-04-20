"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo, useState } from "react";

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
      <header className="rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-4 text-white">
        <p className="text-xs uppercase tracking-widest text-sky-100">Perfil</p>
        <h1 className="text-2xl font-bold">Tu actividad</h1>
      </header>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setTab("partidos")}
          className={`rounded-2xl px-3 py-2 text-xs font-semibold ${tab === "partidos" ? "bg-sky-500 text-white" : "text-slate-600"}`}
        >
          Partidos
        </button>
        <button
          type="button"
          onClick={() => setTab("reservas")}
          className={`rounded-2xl px-3 py-2 text-xs font-semibold ${tab === "reservas" ? "bg-sky-500 text-white" : "text-slate-600"}`}
        >
          Reservas
        </button>
        <button
          type="button"
          onClick={() => setTab("torneos")}
          className={`rounded-2xl px-3 py-2 text-xs font-semibold ${tab === "torneos" ? "bg-sky-500 text-white" : "text-slate-600"}`}
        >
          Torneos
        </button>
      </div>

      {tab === "partidos" ? (
        <section className="space-y-2">
          {matches.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Aún no tenés partidos registrados.
            </div>
          ) : (
            matches.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold capitalize text-slate-900">{formatDate(item.scheduled_date)}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {item.match_status || "sin estado"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">Club: {item.club_name}</p>
                <p className="text-sm text-slate-700">
                  Tipo: {item.match_type === "competitivo" ? "competitivo" : "amistoso"}
                </p>
              </article>
            ))
          )}
        </section>
      ) : null}

      {tab === "reservas" ? (
        <section className="space-y-2">
          {reservations.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Aún no tenés reservas registradas.
            </div>
          ) : (
            reservations.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold capitalize text-slate-900">{formatDate(item.scheduled_date)}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {item.match_status || "sin estado"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">Cancha: {item.court_name}</p>
                <p className="text-sm text-slate-700">
                  Precio: {item.total_price != null ? money.format(item.total_price) : "—"}
                </p>
              </article>
            ))
          )}
        </section>
      ) : null}

      {tab === "torneos" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          Próximamente
        </section>
      ) : null}
    </main>
  );
}
