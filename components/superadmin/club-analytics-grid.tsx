import { format } from "date-fns";
import { moneyArs, type SuperadminClubOverview } from "@/lib/superadmin/club-overview";

export default function ClubAnalyticsGrid({ row }: { row: SuperadminClubOverview }) {
  const cards = [
    { label: "Canchas", value: String(row.courts_count) },
    { label: "Reservas (mes)", value: String(row.reservations_this_month) },
    { label: "Reservas (total)", value: String(row.reservations_total) },
    { label: "Partidos abiertos (mes)", value: String(row.open_matches_this_month) },
    { label: "Ingresos pagados (mes)", value: moneyArs(Number(row.revenue_paid_this_month)) },
    { label: "Ingresos pagados (total)", value: moneyArs(Number(row.revenue_paid_total)) },
    { label: "Jugadores únicos (30d)", value: String(row.unique_players_30d) },
    {
      label: "Última reserva",
      value: row.last_reservation_date
        ? format(new Date(row.last_reservation_date), "dd/MM/yyyy")
        : "Sin actividad",
    },
    { label: "Deuda pendiente", value: moneyArs(Number(row.pending_debt)) },
  ];

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
      <h2 className="text-lg font-bold text-white">Análisis del club</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-white/5 bg-slate-950/50 px-4 py-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="mt-1 text-lg font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
