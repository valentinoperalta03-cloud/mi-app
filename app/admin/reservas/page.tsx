import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { AdminPressableSurface } from "@/components/admin/admin-pressable";
import {
  MatchTypePill,
  PaymentStatusPill,
  PlayerAvatar,
} from "@/components/admin/admin-status-pills";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import ManualBlockFab from "./manual-block-fab";

type MatchRow = {
  id: string;
  date: string;
  court_id: string;
  owner_id: string | null;
  payment_status: string | null;
  total_price: number | null;
  is_competitive: boolean | null;
};

type CourtEmbed = { id: string; name: string | null };

export default async function AdminReservasPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (ctx.clubIds.length === 0) {
    return (
      <div className={`${adminCard} border-amber-200/80 bg-amber-50/90`}>
        <AdminBackLink />
        <p className="mt-4 text-sm font-semibold text-slate-800">Sin club asignado.</p>
      </div>
    );
  }

  const courtNameById = new Map(ctx.courts.map((c) => [c.id, c.name ?? "Cancha"]));

  const { data: matchesRaw, error: matchesError } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.matches)
        .select(
          "id,date,court_id,owner_id,payment_status,total_price,is_competitive,courts(id,name)"
        )
        .in("court_id", ctx.courtIds)
        .order("date", { ascending: true })
    : { data: [], error: null };

  const matches = (matchesRaw ?? []) as unknown as (MatchRow & {
    courts: CourtEmbed | null;
  })[];

  const creatorIds = Array.from(
    new Set(matches.map((m) => m.owner_id).filter(Boolean))
  ) as string[];

  const { data: profilesData } = creatorIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", creatorIds)
    : { data: [] };

  const nameByUser = new Map(
    (profilesData ?? []).map((p: { user_id: string; name: string | null }) => [
      p.user_id,
      p.name ?? "Jugador",
    ])
  );

  const byDay = new Map<string, typeof matches>();
  for (const m of matches) {
    const dayKey = format(parseISO(m.date), "yyyy-MM-dd");
    const list = byDay.get(dayKey) ?? [];
    list.push(m);
    byDay.set(dayKey, list);
  }
  const sortedDays = Array.from(byDay.keys()).sort();

  const courtsForFab = ctx.courts.map((c) => ({
    id: c.id,
    name: c.name ?? "Cancha",
  }));

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-sky-600`}>Agenda</p>
        <h1 className={adminTitle}>Reservas y partidos</h1>
        <p className={adminSubtitle}>
          Jugador, cancha, horario y estado de pago — optimizado para operar desde el celular.
        </p>
      </header>

      {matchesError ? (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 p-6 text-sm font-medium text-rose-800 shadow-sm">
          Error al cargar partidos: {matchesError.message}. Verifica que existan las columnas{" "}
          <code className="text-xs">payment_status</code>, <code className="text-xs">total_price</code>
          , <code className="text-xs">is_competitive</code> en <code className="text-xs">matches</code>
          .
        </div>
      ) : null}

      {!matchesError && sortedDays.length === 0 ? (
        <p className={`${adminCard} text-center text-sm font-medium text-slate-500`}>
          No hay partidos registrados en tus canchas.
        </p>
      ) : null}

      <div className="flex flex-col gap-8">
        {sortedDays.map((dayKey) => {
          const items = byDay.get(dayKey) ?? [];
          const dayLabel = format(parseISO(`${dayKey}T12:00:00`), "EEEE d MMMM yyyy", {
            locale: es,
          });
          return (
            <section key={dayKey} className="flex flex-col gap-4">
              <h2 className="text-xs font-semibold capitalize tracking-wide text-slate-400">
                {dayLabel}
              </h2>
              <ul className="flex flex-col gap-4">
                {items.map((m) => {
                  const t = format(parseISO(m.date), "HH:mm");
                  const court =
                    m.courts?.name ?? courtNameById.get(m.court_id) ?? "Cancha";
                  const player = m.owner_id
                    ? nameByUser.get(m.owner_id) ?? "Jugador"
                    : "Sin asignar";
                  const duration = 90;
                  const payRaw = (m.payment_status ?? "—").toString();
                  return (
                    <li key={m.id}>
                      <AdminPressableSurface className={adminCard}>
                        <div className="flex gap-4">
                          <PlayerAvatar name={player} />
                          <div className="min-w-0 flex-1 space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <p className="truncate text-sm font-semibold text-slate-600">
                                  {player}
                                </p>
                                <p className="text-lg font-bold tracking-tight text-slate-900">
                                  {t}{" "}
                                  <span className="text-slate-400 font-semibold">·</span> {court}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                                <MatchTypePill isCompetitive={m.is_competitive} />
                                <PaymentStatusPill status={payRaw} />
                              </div>
                            </div>
                            <dl className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 text-sm">
                              <div>
                                <dt className={adminKicker}>Horario</dt>
                                <dd className="mt-1 font-semibold text-slate-800">{t}</dd>
                              </div>
                              <div>
                                <dt className={adminKicker}>Duración</dt>
                                <dd className="mt-1 font-semibold text-slate-800">{duration} min</dd>
                              </div>
                              <div>
                                <dt className={adminKicker}>Monto</dt>
                                <dd className="mt-1 font-semibold text-slate-800">
                                  {m.total_price != null
                                    ? `$${Number(m.total_price).toFixed(2)}`
                                    : "—"}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        </div>
                      </AdminPressableSurface>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <ManualBlockFab courts={courtsForFab} />
    </div>
  );
}
