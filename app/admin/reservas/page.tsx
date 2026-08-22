import { format, parseISO } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import AdminGuideBox from "@/components/admin/admin-guide-box";
import AdminPageHeader from "@/components/admin/admin-page-header";
import {
  adminAccentBar,
  adminBadgeDanger,
  adminBadgeWarning,
  adminButtonSecondary,
  adminCard,
  adminKicker,
} from "@/components/admin/admin-premium";
import { PaymentStatusPill, PlayerAvatar } from "@/components/admin/admin-status-pills";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { minutesToClock, parseClockToMinutes, parseCloseTimeToMinutes } from "@/lib/court-slots";
import { createClient } from "@/utils/supabase/server";
import { cancelReservationAdmin, requestReservationRefundAction } from "./actions";
import { confirmOfflineCobro } from "../cobros/actions";
import DateNav from "./date-nav";
import ReservasGridClient, { type GridCellData } from "./reservas-grid-client";
import AdminReservasMobileView, { type MobileCourtData, type MobileSlot } from "./reservas-mobile-view";
import ReservasTabs, { type OpenMatchData } from "./reservas-tabs";

function externalLabelFromReason(reason: string | null | undefined): string {
  const r = String(reason ?? "").trim();
  if (!r) return "Bloqueado";
  if (r === "entrenamiento_externo") return "Entrenamiento";
  const firstWord = r.split(/\s+/)[0];
  const capitalized = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
  return capitalized.length > 14 ? `${capitalized.slice(0, 13)}…` : capitalized;
}

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
  manual_reference: string | null;
  courts: CourtEmbed | null;
};

type PageProps = {
  searchParams: Promise<{ date?: string; selected?: string; refund_error?: string }>;
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

/**
 * ¿Cae `t` (minutos desde medianoche) dentro de alguna franja, con el turno
 * completo (t + 90) sin pasarse del cierre?
 */
function fitsSomeRange(t: number, ranges: Array<{ startMin: number; endMin: number }>, durationMinutes = 90): boolean {
  return ranges.some((r) => t >= r.startMin && t + durationMinutes <= r.endMin);
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
        <p className="mt-4 text-sm font-semibold text-[var(--text-secondary)]">Sin club asignado.</p>
      </div>
    );
  }

  const today = getTodayYmdInArgentina();
  const selectedDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const selectedMatchId = sp.selected?.trim() ?? "";
  const mainClubId = ctx.clubIds[0];
  const dayOfWeek = new Date(`${selectedDate}T12:00:00`).getDay();

  const { data: closedDayRow } = await supabase
    .from(DB_TABLES.clubClosedDays)
    .select("id,reason")
    .eq("club_id", mainClubId)
    .eq("closed_date", selectedDate)
    .maybeSingle();
  const closedDay = closedDayRow as { id: string; reason: string | null } | null;

  const [{ data: clubRow }, { data: timeRangesRaw }] = await Promise.all([
    supabase.from(DB_TABLES.clubs).select("open_time,close_time").eq("id", mainClubId).maybeSingle(),
    ctx.courtIds.length
      ? supabase
          .from(DB_TABLES.courtTimeRanges)
          .select("court_id,open_time,close_time")
          .in("court_id", ctx.courtIds)
          .eq("day_of_week", dayOfWeek)
      : Promise.resolve({ data: [] }),
  ]);
  const clubOpenMin = (clubRow as { open_time?: string | null } | null)?.open_time
    ? parseClockToMinutes(String((clubRow as { open_time?: string | null }).open_time).slice(0, 5))
    : null;
  const clubCloseMin = (clubRow as { close_time?: string | null } | null)?.close_time
    ? parseCloseTimeToMinutes(String((clubRow as { close_time?: string | null }).close_time).slice(0, 5))
    : null;

  const timeRangesByCourt = new Map<string, Array<{ startMin: number; endMin: number }>>();
  for (const r of (timeRangesRaw ?? []) as Array<{ court_id: string; open_time: string; close_time: string }>) {
    const list = timeRangesByCourt.get(r.court_id) ?? [];
    list.push({
      startMin: parseClockToMinutes(String(r.open_time).slice(0, 5)),
      endMin: parseCloseTimeToMinutes(String(r.close_time).slice(0, 5)),
    });
    timeRangesByCourt.set(r.court_id, list);
  }

  // Franjas por cancha (court_time_ranges) — si la cancha no tiene franjas
  // propias hoy, cae al horario global del club como fallback.
  const rangesByCourt: Record<string, Array<{ startMin: number; endMin: number }>> = {};
  for (const court of ctx.courts) {
    const custom = timeRangesByCourt.get(court.id);
    rangesByCourt[court.id] =
      custom && custom.length > 0
        ? custom
        : clubOpenMin != null && clubCloseMin != null && clubCloseMin > clubOpenMin
          ? [{ startMin: clubOpenMin, endMin: clubCloseMin }]
          : [{ startMin: 9 * 60, endMin: 22 * 60 + 30 }];
  }

  // Grilla maestra anclada a la apertura más temprana entre TODAS las
  // canchas: antes cada cancha generaba su propia secuencia de 90min desde
  // su propia apertura, y dos canchas con horarios de apertura distintos casi
  // nunca coincidían en los mismos horarios de reloj (ej. cancha que abre
  // 08:30 → .../14:30/16:00/17:30..., cancha que cae al fallback 08:00 →
  // .../14:00/15:30/17:00... — el "16:00" de la primera nunca existía para la
  // segunda, y se pintaba como no disponible aunque estuviera abierta). Con
  // una única grilla de referencia, todas las canchas comparten los mismos
  // horarios de reloj; una celda vacía ahora significa que esa cancha
  // realmente no tiene franja ahí, no un desalineamiento de cálculo.
  const allRanges = Object.values(rangesByCourt).flat();
  const gridStartMin = allRanges.length ? Math.min(...allRanges.map((r) => r.startMin)) : 9 * 60;
  const masterMinutes: number[] = [];
  for (let t = gridStartMin; t < 24 * 60; t += 90) masterMinutes.push(t);

  const courtSlotTimes: Record<string, string[]> = {};
  for (const court of ctx.courts) {
    const ranges = rangesByCourt[court.id];
    courtSlotTimes[court.id] = masterMinutes.filter((t) => fitsSomeRange(t, ranges)).map((t) => minutesToClock(t));
  }
  const slots = masterMinutes
    .filter((t) => Object.values(courtSlotTimes).some((times) => times.includes(minutesToClock(t))))
    .map((t) => minutesToClock(t));

  const { data: courtBlocksRaw } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.courtBlocks)
        .select("court_id,blocked_time,reason")
        .in("court_id", ctx.courtIds)
        .eq("blocked_date", selectedDate)
    : { data: [] };
  const courtBlocks = (courtBlocksRaw ?? []) as Array<{ court_id: string; blocked_time: string | null; reason: string | null }>;

  const { data: matchesRaw, error: matchesError } = await supabase
    .from(DB_TABLES.matches)
    .select(
      "id,date,scheduled_date,scheduled_time,duration_minutes,court_id,owner_id,payment_status,total_price,amount_paid,amount_pending,financial_status,match_status,location_name,match_type,es_turno_fijo,manual_reference,courts(id,name)"
    )
    .in("court_id", ctx.courtIds)
    .eq("scheduled_date", selectedDate)
    .neq("match_status", "cancelled")
    .order("scheduled_time", { ascending: true });

  const matches = (matchesRaw ?? []) as unknown as MatchRow[];

  const creatorIds = Array.from(new Set(matches.map((m) => m.owner_id).filter(Boolean))) as string[];
  const { data: profilesData } = creatorIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", creatorIds)
    : { data: [] };
  const nameByUser = new Map(
    (profilesData ?? []).map((p: { user_id: string; name: string | null }) => [p.user_id, p.name ?? "Jugador"])
  );

  function labelForMatch(m: MatchRow): string {
    if (m.manual_reference?.trim()) return m.manual_reference.trim();
    return m.owner_id ? nameByUser.get(m.owner_id) ?? "Jugador" : "Sin asignar";
  }

  const slotMap = new Map<string, MatchRow>();
  for (const m of matches) {
    const key = `${m.court_id}__${getSlotBucket(m)}`;
    if (!slotMap.has(key)) slotMap.set(key, m);
  }

  // Capas, de menos a más prioridad: bloqueos puntuales por cancha →
  // reservas/turnos fijos reales (una reserva real siempre gana sobre un
  // bloqueo, por si llegaran a coincidir en datos inconsistentes).
  const cells: Record<string, GridCellData> = {};
  for (const b of courtBlocks) {
    const time = String(b.blocked_time ?? "").slice(0, 5);
    if (!time) continue;
    cells[`${b.court_id}__${time}`] = { kind: "external", label: externalLabelFromReason(b.reason) };
  }
  for (const [key, m] of slotMap) {
    cells[key] = { matchId: m.id, kind: m.es_turno_fijo ? "fixed" : "reservation", label: labelForMatch(m) };
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
  const selectedPaymentsByUser = new Map(selectedPayments.map((p) => [p.user_id, p]));

  const { data: ownerProfileRow } =
    selectedMatch?.owner_id
      ? await supabase
          .from(DB_TABLES.profiles)
          .select("name,avatar_url")
          .eq("user_id", selectedMatch.owner_id)
          .maybeSingle()
      : { data: null };
  const ownerProfile = ownerProfileRow as { name: string | null; avatar_url: string | null } | null;
  const ownerDisplayName = selectedMatch ? labelForMatch(selectedMatch) : "Jugador";

  const selectedPaySt = selectedMatch ? String(selectedMatch.payment_status ?? "").toLowerCase() : "";
  const selectedIsReservation = selectedMatch
    ? String(selectedMatch.match_type ?? "").toLowerCase() === "reservation"
    : false;
  const selectedIsFixed = Boolean(selectedMatch?.es_turno_fijo);

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

  const refundErr = sp.refund_error ? decodeURIComponent(sp.refund_error.replace(/\+/g, " ")) : "";

  const { data: openMatchesRaw } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.matches)
        .select(
          "id,scheduled_date,scheduled_time,match_status,gender_category,category_range,created_by_club,courts(name),match_participants(id,player_id,team,guest_name,profiles(name,avatar_url))"
        )
        .in("court_id", ctx.courtIds)
        .eq("match_type", "amistoso")
        .neq("match_status", "cancelled")
        .gte("scheduled_date", today)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true })
    : { data: [] };

  type OpenParticipantRaw = {
    id: string | null;
    player_id: string | null;
    team: number | null;
    guest_name: string | null;
    profiles: { name: string | null; avatar_url: string | null } | { name: string | null; avatar_url: string | null }[] | null;
  };
  type OpenMatchRaw = {
    id: string;
    scheduled_date: string | null;
    scheduled_time: string | null;
    match_status: string | null;
    gender_category: "masculino" | "femenino" | "mixto" | null;
    category_range: string[] | null;
    created_by_club: boolean | null;
    courts: { name: string | null } | { name: string | null }[] | null;
    match_participants: OpenParticipantRaw[] | null;
  };

  const openMatches: OpenMatchData[] = ((openMatchesRaw ?? []) as unknown as OpenMatchRaw[]).map((m) => {
    const courtEmbed = Array.isArray(m.courts) ? m.courts[0] ?? null : m.courts;
    return {
      id: m.id,
      scheduledDate: m.scheduled_date ?? "",
      scheduledTime: (m.scheduled_time ?? "").slice(0, 5),
      courtName: courtEmbed?.name ?? "Cancha",
      genderCategory: m.gender_category,
      categoryRange: m.category_range ?? [],
      createdByClub: Boolean(m.created_by_club),
      participants: (m.match_participants ?? []).map((p) => {
        const prof = Array.isArray(p.profiles) ? p.profiles[0] ?? null : p.profiles;
        return {
          id: p.id ?? "",
          playerId: p.player_id,
          team: (p.team === 1 || p.team === 2 ? p.team : null) as 1 | 2 | null,
          name: p.guest_name?.trim() || prof?.name?.trim() || "Jugador",
          avatarUrl: p.guest_name ? null : (prof?.avatar_url ?? null),
        };
      }),
    };
  });

  const gridCourts = ctx.courts.map((c) => ({ id: c.id, name: c.name ?? "Cancha" }));

  const mobileCourts: MobileCourtData[] = gridCourts.map((court) => ({
    id: court.id,
    name: court.name,
    slots: (courtSlotTimes[court.id] ?? []).map((slot): MobileSlot => {
      const key = `${court.id}__${slot}`;
      const cell = cells[key];
      if (!cell) return { time: slot, kind: "available" };
      return { time: slot, kind: cell.kind, matchId: cell.matchId, label: cell.label };
    }),
  }));

  const closeHref = `/admin/reservas?date=${selectedDate}`;

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />

      <AdminPageHeader
        kicker="Agenda diaria"
        title="Gestión de reservas"
        subtitle="Vista por canchas para operar el día sin fricción"
      />

      <AdminGuideBox title="¿Cómo gestionar reservas?">
        <ol className="list-decimal space-y-1.5 pl-4 text-[var(--text-secondary)]">
          <li>Las reservas online llegan automáticamente cuando un jugador paga la seña por Mercado Pago.</li>
          <li>Las reservas manuales las cargás vos desde el botón <strong>&quot;Nueva reserva&quot;</strong>.</li>
          <li>Desde <strong>&quot;Cobros y pagos&quot;</strong> registrás los cobros en efectivo o transferencia del día.</li>
          <li>
            Los partidos abiertos aparecen en la tab <strong>&quot;Partidos abiertos&quot;</strong> — se confirman
            cuando se completan los 4 jugadores.
          </li>
        </ol>
      </AdminGuideBox>

      <ReservasTabs
        openMatches={openMatches}
        courts={gridCourts}
        clubId={mainClubId}
        clubName={ctx.clubs.find((c) => c.id === mainClubId)?.name ?? "Club"}
      >
        <section className={adminCard}>
          <DateNav selectedDate={selectedDate} today={today} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className={`${adminCard} ${adminAccentBar}`}>
            <p className={adminKicker}>Total reservas del día</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{totalReservas}</p>
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
            <p className="mt-2 text-2xl font-bold text-[var(--text-tertiary)]">{unpaidReservas}</p>
          </div>
        </section>

        {closedDay ? (
          <div className="rounded-2xl border-l-[3px] border-[var(--admin-alert-warning-border)] bg-[var(--admin-alert-warning-bg)] p-5 text-sm font-semibold text-[var(--admin-alert-warning-text)]">
            El club está cerrado este día{closedDay.reason ? ` (${closedDay.reason})` : ""}. No se muestra la grilla.
          </div>
        ) : matchesError ? (
          <div
            className={`${adminCard} border-rose-200/80 bg-rose-50/90 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200`}
          >
            Error al cargar reservas: {matchesError.message}.
          </div>
        ) : (
          <>
            <section className={`${adminCard} hidden overflow-hidden p-0 md:block`}>
              <ReservasGridClient
                courts={gridCourts}
                slots={slots}
                courtSlotTimes={courtSlotTimes}
                cells={cells}
                selectedDate={selectedDate}
              />
            </section>

            <AdminReservasMobileView courts={mobileCourts} selectedDate={selectedDate} />
          </>
        )}
      </ReservasTabs>

      {selectedMatch ? (
        <>
          <Link
            href={closeHref}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
            aria-label="Cerrar detalle"
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
            <section
              className={`${adminCard} pointer-events-auto max-h-[90vh] w-full max-w-lg overflow-y-auto border-[#0085FC]/20 bg-[var(--bg-card)]`}
              style={{ borderRadius: 16 }}
            >
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
                    <p className={adminKicker}>{selectedIsFixed ? "Turno fijo" : "Detalle de reserva"}</p>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">{ownerDisplayName}</h2>
                  </div>
                </div>
                {!selectedIsFixed ? <PaymentStatusPill status={String(selectedMatch.payment_status ?? "—")} /> : null}
              </div>

              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/50 px-3 py-2">
                  <dt className={adminKicker}>Cancha</dt>
                  <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
                    {selectedMatch.courts?.name ?? ctx.courts.find((c) => c.id === selectedMatch.court_id)?.name ?? "Cancha"}
                  </dd>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/50 px-3 py-2">
                  <dt className={adminKicker}>Horario</dt>
                  <dd className="mt-1 font-semibold text-[var(--text-secondary)]">{getTimeFromMatch(selectedMatch)}</dd>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/50 px-3 py-2">
                  <dt className={adminKicker}>Duración</dt>
                  <dd className="mt-1 font-semibold text-[var(--text-secondary)]">{durationMin(selectedMatch)} min</dd>
                </div>
                {!selectedIsFixed ? (
                  <>
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/50 px-3 py-2">
                      <dt className={adminKicker}>Método de pago (reserva)</dt>
                      <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
                        {selectedIsReservation ? reservationMethodLabel(selectedMatch.payment_status) : "—"}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/50 px-3 py-2">
                      <dt className={adminKicker}>Precio total del turno</dt>
                      <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
                        {selectedMatch.total_price != null ? `$${Number(selectedMatch.total_price).toLocaleString("es-AR")}` : "—"}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/50 px-3 py-2">
                      <dt className={adminKicker}>Pagado</dt>
                      <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
                        ${Number(selectedMatch.amount_paid ?? 0).toLocaleString("es-AR")}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/50 px-3 py-2">
                      <dt className={adminKicker}>Saldo pendiente en club</dt>
                      <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
                        ${Number(selectedMatch.amount_pending ?? 0).toLocaleString("es-AR")}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>

              <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/50 p-3">
                <p className={adminKicker}>Jugadores{!selectedIsFixed ? " y pagos" : ""}</p>
                {selectedMatchParticipants.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--text-tertiary)]">Sin jugadores asignados aún.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {selectedMatchParticipants.map((player) => {
                      const payment = selectedPaymentsByUser.get(player.playerId);
                      return (
                        <li key={player.playerId} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {player.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
                              <img src={player.avatarUrl} alt={player.name} className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <PlayerAvatar name={player.name} />
                            )}
                            <span className="text-sm font-medium text-[var(--text-secondary)]">{player.name}</span>
                          </div>
                          {!selectedIsFixed ? (
                            <span className="text-right text-xs text-[var(--text-tertiary)]">
                              {payment
                                ? `${payment.payment_method ?? "—"} · ${String(payment.status ?? "")} · $${Number(payment.amount ?? 0).toFixed(2)}`
                                : "Sin pago registrado"}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-4">
                {refundErr ? (
                  <p className="mb-2 rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
                    {refundErr}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {selectedIsFixed ? (
                    <Link href="/admin/turnos-fijos" className={adminButtonSecondary}>
                      Ver en turnos fijos
                    </Link>
                  ) : (
                    <>
                      {selectedIsReservation && (selectedPaySt === "cash_pending" || selectedPaySt === "transfer_pending") ? (
                        <form action={confirmOfflineCobro}>
                          <input type="hidden" name="match_id" value={selectedMatch.id} />
                          <button type="submit" className={adminButtonSecondary}>
                            {selectedPaySt === "cash_pending" ? "Confirmar cobro en efectivo" : "Confirmar transferencia recibida"}
                          </button>
                        </form>
                      ) : null}
                      {selectedIsReservation && selectedPaySt === "paid" ? (
                        <form action={requestReservationRefundAction}>
                          <input type="hidden" name="match_id" value={selectedMatch.id} />
                          <input type="hidden" name="date" value={selectedDate} />
                          <button type="submit" className={adminBadgeWarning}>
                            Reembolsar
                          </button>
                        </form>
                      ) : null}
                      {selectedIsReservation ? (
                        <form action={cancelReservationAdmin}>
                          <input type="hidden" name="match_id" value={selectedMatch.id} />
                          <input type="hidden" name="date" value={selectedDate} />
                          <button type="submit" className={adminBadgeDanger}>
                            Cancelar reserva
                          </button>
                        </form>
                      ) : null}
                    </>
                  )}
                  <Link href={closeHref} className={adminButtonSecondary}>
                    Cerrar
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
