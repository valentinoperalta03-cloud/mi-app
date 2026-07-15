import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { PaymentStatusPill, PlayerAvatar } from "@/components/admin/admin-status-pills";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { parseClockToMinutes, minutesToClock } from "@/lib/court-slots";
import { createClient } from "@/utils/supabase/server";
import {
  addClubClosedDayAction,
  blockCourtSlotAction,
  cancelReservationAdmin,
  removeClubClosedDayAction,
  requestReservationRefundAction,
} from "./actions";
import { confirmOfflineCobro } from "../cobros/actions";
import AdminReservasMobileView, { type MobileCourtData, type MobileSlot } from "./reservas-mobile-view";

type CourtEmbed = { id: string; name: string | null };
type MatchRow = {
  id: string;
  date: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  court_id: string;
  owner_id: string | null;
  payment_status: string | null;
  total_price: number | null;
  amount_paid: number | null;
  amount_pending: number | null;
  financial_status: string | null;
  match_status: string | null;
  location_name: string | null;
  match_type: string | null;
  es_turno_fijo: boolean | null;
  courts: CourtEmbed | null;
};
type BlockRow = {
  court_id: string;
  blocked_date: string | null;
  blocked_time: string | null;
  reason: string | null;
};

type PageProps = {
  searchParams: Promise<{ date?: string; selected?: string; closed_error?: string }>;
};

function getTimeFromMatch(m: MatchRow): string {
  if (m.scheduled_time) return String(m.scheduled_time).trim().slice(0, 5);
  try {
    return format(parseISO(m.date), "HH:mm");
  } catch {
    return "--:--";
  }
}

function getSlotBucket(m: MatchRow): string {
  const time = getTimeFromMatch(m);
  if (!/^\d{2}:\d{2}$/.test(time)) return "00:00";
  return time;
}

function durationMin(m: MatchRow): number {
  return m.duration_minutes && m.duration_minutes > 0 ? m.duration_minutes : 90;
}

function reservationMethodLabel(paymentStatus: string | null | undefined) {
  const s = String(paymentStatus ?? "").toLowerCase();
  if (s === "paid") return "Mercado Pago ✅";
  if (s === "cash_pending") return "Efectivo ⏳";
  if (s === "transfer_pending") return "Transferencia ⏳";
  if (s === "pending") return "Mercado Pago ⏳";
  if (s === "refund_requested") return "Reembolso solicitado ⏳";
  if (s === "cancelled" || s === "expired") return "Cancelado";
  return s || "—";
}

export default async function AdminReservasPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  if (ctx.clubIds.length === 0) {
    return (
      <div className={`${adminCard} border-amber-200/80 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/40`}>
        <AdminBackLink />
        <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-200">Sin club asignado.</p>
      </div>
    );
  }

  const selectedDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : getTodayYmdInArgentina();
  const selectedMatchId = sp.selected?.trim() ?? "";

  const { data: matchesRaw, error: matchesError } = await supabase
    .from(DB_TABLES.matches)
    .select(
      "id,date,scheduled_date,scheduled_time,duration_minutes,court_id,owner_id,payment_status,total_price,amount_paid,amount_pending,financial_status,match_status,location_name,match_type,es_turno_fijo,courts(id,name)"
    )
    .in("court_id", ctx.courtIds)
    .eq("scheduled_date", selectedDate)
    .neq("match_status", "cancelled")
    .order("scheduled_time", { ascending: true });

  const matches = (matchesRaw ?? []) as unknown as MatchRow[];
  const { data: blocksRaw } = await supabase
    .from(DB_TABLES.courtBlocks)
    .select("court_id,blocked_date,blocked_time,reason")
    .in("court_id", ctx.courtIds)
    .eq("blocked_date", selectedDate);
  const blocks = (blocksRaw ?? []) as BlockRow[];

  const mainClubId = ctx.clubIds[0];
  const [{ data: closedDaysRaw }, { data: clubOpenRow }] = await Promise.all([
    supabase
      .from(DB_TABLES.clubClosedDays)
      .select("id,closed_date,reason")
      .eq("club_id", mainClubId)
      .gte("closed_date", getTodayYmdInArgentina())
      .order("closed_date", { ascending: true }),
    supabase
      .from(DB_TABLES.clubs)
      .select("open_time")
      .eq("id", mainClubId)
      .maybeSingle(),
  ]);
  const closedDays = (closedDaysRaw ?? []) as Array<{ id: string; closed_date: string; reason: string | null }>;
  const clubOpenTime = String((clubOpenRow as { open_time?: string | null } | null)?.open_time ?? "09:00").trim().slice(0, 5) || "09:00";
  const rawOpenMin = parseClockToMinutes(clubOpenTime);
  const slots: string[] = [];
  for (let t = rawOpenMin; t < 24 * 60; t += 90) {
    slots.push(minutesToClock(t));
  }

  const creatorIds = Array.from(new Set(matches.map((m) => m.owner_id).filter(Boolean))) as string[];
  const { data: profilesData } = creatorIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", creatorIds)
    : { data: [] };
  const nameByUser = new Map(
    (profilesData ?? []).map((p: { user_id: string; name: string | null }) => [p.user_id, p.name ?? "Jugador"])
  );

  const slotMap = new Map<string, MatchRow>();
  for (const m of matches) {
    const key = `${m.court_id}__${getSlotBucket(m)}`;
    if (!slotMap.has(key)) slotMap.set(key, m);
  }
  const blockMap = new Map<string, BlockRow>();
  for (const block of blocks) {
    const hour = String(block.blocked_time ?? "").trim().slice(0, 5);
    if (!hour) continue;
    const key = `${block.court_id}__${hour}`;
    blockMap.set(key, block);
  }

  const selectedMatch = selectedMatchId ? matches.find((m) => m.id === selectedMatchId) ?? null : null;
  const selectedMatchParticipantsRaw = selectedMatch
    ? await supabase
        .from(DB_TABLES.matchParticipants)
        .select("player_id,profiles(name,avatar_url)")
        .eq("match_id", selectedMatch.id)
    : { data: [] };
  const selectedMatchParticipants = ((selectedMatchParticipantsRaw.data ?? []) as Array<{
    player_id: string;
    profiles:
      | { name: string | null; avatar_url: string | null }
      | { name: string | null; avatar_url: string | null }[]
      | null;
  }>).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      playerId: row.player_id,
      name: profile?.name?.trim() || nameByUser.get(row.player_id) || "Jugador",
      avatarUrl: profile?.avatar_url ?? null,
    };
  });

  const selectedPaymentsRaw = selectedMatch
    ? await supabase
        .from(DB_TABLES.payments)
        .select("user_id,status,payment_method,amount")
        .eq("match_id", selectedMatch.id)
    : { data: [] };
  const selectedPayments = (selectedPaymentsRaw.data ?? []) as Array<{
    user_id: string;
    status: string | null;
    payment_method: string | null;
    amount: number | null;
  }>;

  const { data: ownerProfileRow } =
    selectedMatch?.owner_id
      ? await supabase
          .from(DB_TABLES.profiles)
          .select("name,avatar_url")
          .eq("user_id", selectedMatch.owner_id)
          .maybeSingle()
      : { data: null };
  const ownerProfile = ownerProfileRow as { name: string | null; avatar_url: string | null } | null;
  const ownerDisplayName =
    ownerProfile?.name?.trim() ||
    (selectedMatch?.owner_id ? nameByUser.get(selectedMatch.owner_id) : undefined) ||
    "Jugador";

  const selectedPaySt = selectedMatch ? String(selectedMatch.payment_status ?? "").toLowerCase() : "";
  const selectedIsReservation = selectedMatch
    ? String(selectedMatch.match_type ?? "").toLowerCase() === "reservation"
    : false;

  const reservationMatches = matches.filter((m) => String(m.match_type ?? "").toLowerCase() === "reservation");
  const totalReservas = reservationMatches.length;
  const fullyPaidReservas = reservationMatches.filter(
    (m) => String(m.financial_status ?? "").toLowerCase() === "fully_paid"
  ).length;
  const partiallyPaidReservas = reservationMatches.filter(
    (m) => String(m.financial_status ?? "").toLowerCase() === "partially_paid"
  ).length;
  const unpaidReservas = reservationMatches.filter(
    (m) => String(m.financial_status ?? "").toLowerCase() === "unpaid"
  ).length;

  const titleDate = format(parseISO(`${selectedDate}T12:00:00`), "EEEE d 'de' MMMM", { locale: es });
  const closedErr = sp.closed_error ? decodeURIComponent(sp.closed_error.replace(/\+/g, " ")) : "";

  const mobileCourts: MobileCourtData[] = ctx.courts.map((court) => ({
    id: court.id,
    name: court.name ?? "Cancha",
    slots: slots.map((slot): MobileSlot => {
      const slotKey = `${court.id}__${slot}`;
      const reservation = slotMap.get(slotKey);
      const blocked = blockMap.get(slotKey);
      if (!reservation) {
        if (blocked) {
          return { time: slot, kind: "blocked", blockedReason: blocked.reason ?? null };
        }
        return { time: slot, kind: "available" };
      }
      const player = reservation.owner_id ? nameByUser.get(reservation.owner_id) ?? "Jugador" : "Sin asignar";
      const isReservation = String(reservation.match_type ?? "").toLowerCase() === "reservation";
      const payNorm = String(reservation.payment_status ?? "").toLowerCase();
      const paidReservation = isReservation && payNorm === "paid";
      const pendingReservation = isReservation && payNorm === "pending";
      const statusText = paidReservation
        ? "✓ Pagado"
        : pendingReservation
          ? "⚠ Pendiente"
          : isReservation
            ? "Reserva"
            : "Partido abierto";
      return {
        time: slot,
        kind: reservation.es_turno_fijo ? "fixed" : "reservation",
        player,
        statusText,
        financialStatus: String(reservation.financial_status ?? "").toLowerCase() || null,
        href: `/admin/reservas?date=${selectedDate}&selected=${reservation.id}`,
      };
    }),
  }));

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />

      <header className={`${adminCard} relative overflow-hidden`}>
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#0585FC]/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className={`${adminKicker} text-[#0585FC]`}>Agenda diaria</p>
            <h1 className={adminTitle}>Gestión de reservas</h1>
            <p className={adminSubtitle}>Vista calendario por canchas para operar el día sin fricción.</p>
          </div>
        </div>
      </header>

      <section className={`${adminCard} flex flex-col gap-4`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={adminKicker}>Fecha seleccionada</p>
            <p className="mt-1 text-lg font-semibold capitalize text-slate-900 dark:text-slate-100">{titleDate}</p>
          </div>
          <form className="flex items-center gap-2">
            <input
              type="date"
              name="date"
              defaultValue={selectedDate}
              className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
            <button
              type="submit"
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Ver día
            </button>
          </form>
        </div>
      </section>

      <section className={`${adminCard} flex flex-col gap-4`}>
        <div>
          <p className={adminKicker}>Días cerrados</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            El club no ofrecerá turnos en esas fechas (jugadores verán el día cerrado al reservar).
          </p>
        </div>
        {closedErr ? (
          <p className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            {closedErr}
          </p>
        ) : null}
        <form action={addClubClosedDayAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="return_date" value={selectedDate} />
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Fecha
            <input
              type="date"
              name="closed_date"
              required
              min={getTodayYmdInArgentina()}
              className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Motivo (opcional)
            <input
              name="reason"
              type="text"
              placeholder="Ej: feriado, torneo interno"
              className="rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <button
            type="submit"
            className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Marcar como cerrado
          </button>
        </form>
        {closedDays.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No hay días cerrados futuros cargados.</p>
        ) : (
          <ul className="divide-y divide-slate-200/80 rounded-xl border border-slate-200/80 dark:divide-slate-700 dark:border-slate-700">
            {closedDays.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {format(parseISO(`${row.closed_date}T12:00:00`), "EEEE d MMM yyyy", { locale: es })}
                  </p>
                  {row.reason ? <p className="text-slate-500 dark:text-slate-400">{row.reason}</p> : null}
                </div>
                <form action={removeClubClosedDayAction}>
                  <input type="hidden" name="closed_day_id" value={row.id} />
                  <input type="hidden" name="return_date" value={selectedDate} />
                  <button
                    type="submit"
                    className="rounded-full border border-rose-200 bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                  >
                    Eliminar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={adminCard}>
          <p className={adminKicker}>Total reservas del día</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{totalReservas}</p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Abonado</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{fullyPaidReservas}</p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Seña abonada</p>
          <p className="mt-2 text-2xl font-bold text-amber-500">{partiallyPaidReservas}</p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Pendiente</p>
          <p className="mt-2 text-2xl font-bold text-slate-500">{unpaidReservas}</p>
        </div>
      </section>

      {matchesError ? (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 p-6 text-sm font-medium text-rose-800">
          Error al cargar reservas: {matchesError.message}.
        </div>
      ) : (
        <>
          <section className={`${adminCard} hidden overflow-hidden p-0 md:block`}>
            <div className="overflow-x-auto">
              <div className="min-w-[1100px]">
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `84px repeat(${ctx.courts.length}, minmax(180px, 1fr))` }}
                >
                  <div className="sticky left-0 z-20 flex items-center justify-end border-r border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                    Hora
                  </div>
                  {ctx.courts.map((court) => (
                    <div
                      key={court.id}
                      className="border-r border-white/15 px-3 py-3 text-sm font-semibold text-white"
                      style={{ background: "var(--admin-header-bg)" }}
                    >
                      {court.name ?? "Cancha"}
                    </div>
                  ))}
                </div>

                {slots.map((slot) => (
                  <div
                    key={slot}
                    className="grid border-b border-[var(--border-subtle)]"
                    style={{ gridTemplateColumns: `84px repeat(${ctx.courts.length}, minmax(180px, 1fr))` }}
                  >
                    <div className="sticky left-0 z-10 border-r border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-4 text-right text-xs font-medium text-[var(--text-secondary)]">
                      {slot}
                    </div>
                    {ctx.courts.map((court) => {
                      const slotKey = `${court.id}__${slot}`;
                      const reservation = slotMap.get(slotKey);
                      const blocked = blockMap.get(slotKey);
                      if (!reservation) {
                        return (
                          <div key={slotKey} className="min-h-16 border-r border-[var(--border-subtle)] p-2">
                            {blocked ? (
                              <form
                                action={blockCourtSlotAction}
                                className="h-full rounded-lg border border-[var(--border-subtle)] p-2 text-center"
                                style={{
                                  backgroundColor: "var(--bg-app)",
                                  backgroundImage:
                                    "repeating-linear-gradient(45deg, var(--border-subtle) 0, var(--border-subtle) 1px, transparent 1px, transparent 8px)",
                                }}
                              >
                                <input type="hidden" name="court_id" value={court.id} />
                                <input type="hidden" name="date" value={selectedDate} />
                                <input type="hidden" name="time" value={slot} />
                                <button type="submit" className="w-full text-xs font-semibold text-[var(--text-tertiary)]">
                                  Bloqueado
                                </button>
                                <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                                  {blocked.reason ? blocked.reason : "Toque para desbloquear"}
                                </p>
                              </form>
                            ) : (
                              <details className="h-full rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] p-2 transition-colors hover:border-[var(--admin-brand-primary)] hover:bg-[#0585FC]/[0.04] open:border-[var(--admin-brand-primary)] open:bg-[#0585FC]/[0.04]">
                                <summary className="cursor-pointer list-none text-center text-[11px] font-medium text-[var(--text-tertiary)] [&::-webkit-details-marker]:hidden">
                                  Disponible
                                </summary>
                                <form action={blockCourtSlotAction} className="mt-2 space-y-2">
                                  <input type="hidden" name="court_id" value={court.id} />
                                  <input type="hidden" name="date" value={selectedDate} />
                                  <input type="hidden" name="time" value={slot} />
                                  <input
                                    type="text"
                                    name="reason"
                                    placeholder="Motivo (opcional)"
                                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                  <button
                                    type="submit"
                                    className="w-full rounded-lg bg-slate-900 px-2 py-1.5 text-xs font-semibold text-white"
                                  >
                                    Bloquear
                                  </button>
                                </form>
                              </details>
                            )}
                          </div>
                        );
                      }
                      const player = reservation.owner_id ? nameByUser.get(reservation.owner_id) ?? "Jugador" : "Sin asignar";
                      const isReservation = String(reservation.match_type ?? "").toLowerCase() === "reservation";
                      const payNorm = String(reservation.payment_status ?? "").toLowerCase();
                      const paidReservation = isReservation && payNorm === "paid";
                      const pendingReservation = isReservation && payNorm === "pending";
                      const statusText = paidReservation
                        ? "✓ Pagado"
                        : pendingReservation
                          ? "⚠ Pendiente"
                          : isReservation
                            ? "Reserva"
                            : "Partido abierto";
                      const finStatus = String(reservation.financial_status ?? "").toLowerCase();
                      const finIndicator =
                        finStatus === "fully_paid" ? (
                          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold opacity-90">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Abonado
                          </p>
                        ) : finStatus === "partially_paid" ? (
                          <p
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold opacity-90"
                            title={`Pagó $${Number(reservation.amount_paid ?? 0).toLocaleString("es-AR")} · Saldo $${Number(reservation.amount_pending ?? 0).toLocaleString("es-AR")} en club`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-accent-lima)]" /> Seña abonada
                          </p>
                        ) : null;
                      const isFixed = Boolean(reservation.es_turno_fijo);
                      const finAccentClass =
                        finStatus === "partially_paid"
                          ? "border-l-[3px] border-l-[var(--admin-accent-lima)]"
                          : finStatus === "fully_paid"
                            ? "border-l-[3px] border-l-emerald-500"
                            : "";
                      return (
                        <Link
                          key={slotKey}
                          href={`/admin/reservas?date=${selectedDate}&selected=${reservation.id}`}
                          className="block min-h-16 border-r border-[var(--border-subtle)] p-2"
                        >
                          {isFixed ? (
                            <div
                              className="h-full rounded-lg border px-3 py-2"
                              style={{
                                background: "var(--admin-accent-lima-subtle)",
                                borderColor: "var(--admin-accent-lima-border)",
                              }}
                            >
                              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{player}</p>
                              <span
                                className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-[#031733]"
                                style={{ backgroundColor: "var(--admin-accent-lima)" }}
                              >
                                Turno fijo
                              </span>
                            </div>
                          ) : (
                            <div
                              className={`h-full rounded-lg px-3 py-2 text-white shadow-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${finAccentClass}`}
                              style={{ background: "var(--admin-brand-gradient)" }}
                            >
                              <p className="truncate text-sm font-semibold">{player}</p>
                              <p className="text-xs opacity-90">{statusText}</p>
                              {finIndicator}
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <AdminReservasMobileView courts={mobileCourts} selectedDate={selectedDate} blockAction={blockCourtSlotAction} />
        </>
      )}

      {selectedMatch ? (
        <section className={`${adminCard} border-[#0585FC]/20 bg-[#0585FC]/5 dark:bg-slate-900/40`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {ownerProfile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
                <img
                  src={ownerProfile.avatar_url}
                  alt={ownerDisplayName}
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-white/30"
                />
              ) : (
                <PlayerAvatar name={ownerDisplayName} />
              )}
              <div>
                <p className={adminKicker}>{selectedIsReservation ? "Detalle de reserva" : "Detalle del turno"}</p>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{ownerDisplayName}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Contacto en perfil: el jugador puede completar datos desde la app.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedMatch.es_turno_fijo ? (
                <span className="inline-flex rounded-full border border-[#0585FC]/30 bg-[#0585FC]/10 px-2 py-1 text-xs font-semibold text-[#0461C4] dark:text-sky-300">
                  🔄 Turno fijo
                </span>
              ) : null}
              <PaymentStatusPill status={String(selectedMatch.payment_status ?? "—")} />
            </div>
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <dt className={adminKicker}>Cancha</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                {selectedMatch.courts?.name ?? ctx.courts.find((c) => c.id === selectedMatch.court_id)?.name ?? "Cancha"}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <dt className={adminKicker}>Horario</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{getTimeFromMatch(selectedMatch)}</dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <dt className={adminKicker}>Duración</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{durationMin(selectedMatch)} min</dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <dt className={adminKicker}>Método de pago (reserva)</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                {selectedIsReservation ? reservationMethodLabel(selectedMatch.payment_status) : "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <dt className={adminKicker}>Estado del pago</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                {String(selectedMatch.payment_status ?? "—")}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <dt className={adminKicker}>Precio total del turno</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                {selectedMatch.total_price != null ? `$${Number(selectedMatch.total_price).toLocaleString("es-AR")}` : "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <dt className={adminKicker}>Pagado (seña o total)</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                ${Number(selectedMatch.amount_paid ?? 0).toLocaleString("es-AR")}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <dt className={adminKicker}>Saldo pendiente en club</dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                ${Number(selectedMatch.amount_pending ?? 0).toLocaleString("es-AR")}
              </dd>
            </div>
          </dl>

          {selectedPayments.length > 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className={adminKicker}>Pagos registrados</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                {selectedPayments.map((p, i) => (
                  <li key={`${p.user_id}-${i}`} className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{p.payment_method ?? "—"}</span>
                    <span>
                      {String(p.status ?? "")} · ${Number(p.amount ?? 0).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className={adminKicker}>Jugadores</p>
            {selectedMatchParticipants.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sin jugadores asignados aún.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {selectedMatchParticipants.map((player) => (
                  <li key={player.playerId} className="flex items-center gap-2">
                    {player.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
                      <img src={player.avatarUrl} alt={player.name} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <PlayerAvatar name={player.name} />
                    )}
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{player.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              {selectedIsReservation && (selectedPaySt === "cash_pending" || selectedPaySt === "transfer_pending") ? (
                <form action={confirmOfflineCobro}>
                  <input type="hidden" name="match_id" value={selectedMatch.id} />
                  <button
                    type="submit"
                    className="inline-flex rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                  >
                    {selectedPaySt === "cash_pending" ? "Confirmar cobro en efectivo" : "Confirmar transferencia recibida"}
                  </button>
                </form>
              ) : null}
              {selectedIsReservation && selectedPaySt === "paid" ? (
                <form action={requestReservationRefundAction}>
                  <input type="hidden" name="match_id" value={selectedMatch.id} />
                  <input type="hidden" name="date" value={selectedDate} />
                  <button
                    type="submit"
                    className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                  >
                    Reembolsar
                  </button>
                </form>
              ) : null}
              {selectedIsReservation ? (
                <form action={cancelReservationAdmin}>
                  <input type="hidden" name="match_id" value={selectedMatch.id} />
                  <input type="hidden" name="date" value={selectedDate} />
                  <button
                    type="submit"
                    className="inline-flex rounded-full border border-rose-300 bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100"
                  >
                    Cancelar reserva
                  </button>
                </form>
              ) : null}
              <Link
                href={`/admin/reservas?date=${selectedDate}`}
                className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                Cerrar detalle
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
