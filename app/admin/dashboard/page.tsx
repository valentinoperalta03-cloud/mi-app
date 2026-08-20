import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  ChevronRight,
  Clock,
  DollarSign,
  MapPin,
} from "lucide-react";
import { adminCard, adminKicker } from "@/components/admin/admin-premium";
import { PaymentStatusPill } from "@/components/admin/admin-status-pills";
import OnboardingChecklist from "@/components/admin/onboarding-checklist";
import DashboardClubLink from "./dashboard-club-link";
import FixedSlotTodayCard, { type TodayFixedSlotCard } from "./fixed-slot-today-card";
import SuperadminEntryLink from "@/components/superadmin/superadmin-entry-link";
import { formatDateInArgentina, getTodayYmdInArgentina, utcMsForArgentinaWallClock } from "@/lib/datetime-ar";
import { checkOnboardingStatus } from "@/lib/admin/onboarding-check";
import { checkAdminOnboardingStatus } from "@/lib/admin/onboarding-status";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import CurrentArTime from "./current-ar-time";
import DashboardClient from "./dashboard-client";
import { buildDashboardTimelineData } from "./dashboard-timeline-data";

/** Kicker de las 4 métricas: azul #0085FC en claro, lima #CCFF00 en oscuro (token --admin-accent-lima). */
const metricKicker =
  "font-admin-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-accent-lima)]";

function getArgentinaNow() {
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const y = dateParts.find((p) => p.type === "year")?.value ?? "1970";
  const m = dateParts.find((p) => p.type === "month")?.value ?? "01";
  const d = dateParts.find((p) => p.type === "day")?.value ?? "01";
  const hh = Number(timeParts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(timeParts.find((p) => p.type === "minute")?.value ?? "0");
  return { ymd: `${y}-${m}-${d}`, minutes: hh * 60 + mm };
}

function timeToMinutes(value: string | null): number {
  const t = String(value ?? "").slice(0, 5);
  const [hRaw, mRaw] = t.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ subscription?: string }>;
}) {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (ctx.clubIds.length === 0) redirect("/admin/club");

  const sp = (await searchParams) ?? {};
  const subscriptionActivated = sp.subscription === "activated";

  const today = getTodayYmdInArgentina();
  const arNow = getArgentinaNow();
  const weekdayDateLabelRaw = formatDateInArgentina(`${today}T12:00:00`, {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const weekdayDateLabel = weekdayDateLabelRaw.charAt(0).toUpperCase() + weekdayDateLabelRaw.slice(1);
  const weekAgoDate = new Date(`${today}T12:00:00`);
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const weekAgo = weekAgoDate.toISOString().slice(0, 10);

  const { data: clubInfoRaw } = await supabase
    .from(DB_TABLES.clubs)
    .select("id,name,logo_url,onboarding_completed,open_time,close_time,slug")
    .in("id", ctx.clubIds)
    .order("name", { ascending: true })
    .limit(1);
  const club = ((clubInfoRaw ?? [])[0] ?? null) as
    | {
        id: string;
        name: string | null;
        logo_url: string | null;
        onboarding_completed?: boolean | null;
        open_time?: string | null;
        close_time?: string | null;
        slug?: string | null;
      }
    | null;
  const clubName = String(club?.name ?? "Mi club").trim() || "Mi club";
  const clubSlug = club?.slug?.trim() || null;

  const { data: todayMatchesRaw } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.matches)
        .select(
          "id,court_id,owner_id,payment_status,scheduled_time,scheduled_date,match_status,match_type,es_turno_fijo,fixed_slot_id,duration_minutes,courts(name)"
        )
        .in("court_id", ctx.courtIds)
        .eq("scheduled_date", today)
    : { data: [] };
  const todayMatches = (todayMatchesRaw ?? []) as Array<{
    id: string;
    court_id: string;
    owner_id: string | null;
    payment_status: string | null;
    scheduled_time: string | null;
    scheduled_date: string | null;
    match_status: string | null;
    match_type: string | null;
    es_turno_fijo: boolean | null;
    fixed_slot_id: string | null;
    duration_minutes: number | null;
    courts: { name: string | null } | { name: string | null }[] | null;
  }>;
  const todayDayOfWeek = new Date(`${today}T12:00:00`).getDay();
  const todayMatchIds = todayMatches.map((m) => m.id);
  const matchByFixedSlotId = new Map(
    todayMatches
      .filter((m) => m.es_turno_fijo && m.fixed_slot_id && String(m.match_status ?? "").toLowerCase() !== "cancelled")
      .map((m) => [String(m.fixed_slot_id), m])
  );

  const { data: fixedSlotsTodayRaw } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.fixedSlots)
        .select("id,court_id,title,start_time,duration_minutes")
        .in("court_id", ctx.courtIds)
        .eq("is_active", true)
        .eq("day_of_week", todayDayOfWeek)
    : { data: [] };
  const fixedSlotsToday = (fixedSlotsTodayRaw ?? []) as Array<{
    id: string;
    court_id: string;
    title: string | null;
    start_time: string | null;
    duration_minutes: number | null;
  }>;
  const fixedSlotsTodayCount = fixedSlotsToday.length;

  const fixedSlotIdsToday = fixedSlotsToday.map((s) => s.id);
  const { data: fixedExceptionsTodayRaw } = fixedSlotIdsToday.length
    ? await supabase
        .from(DB_TABLES.fixedSlotExceptions)
        .select("fixed_slot_id")
        .in("fixed_slot_id", fixedSlotIdsToday)
        .eq("exception_date", today)
    : { data: [] };
  const exceptedFixedSlotIdsToday = new Set(
    ((fixedExceptionsTodayRaw ?? []) as Array<{ fixed_slot_id: string }>).map((e) => e.fixed_slot_id)
  );

  const { data: fixedSlotPlayersTodayRaw } = fixedSlotIdsToday.length
    ? await supabase
        .from(DB_TABLES.fixedSlotPlayers)
        .select("fixed_slot_id,player_id")
        .in("fixed_slot_id", fixedSlotIdsToday)
    : { data: [] };
  const fixedSlotPlayersToday = (fixedSlotPlayersTodayRaw ?? []) as Array<{
    fixed_slot_id: string;
    player_id: string;
  }>;
  const fixedSlotPlayerIds = Array.from(new Set(fixedSlotPlayersToday.map((p) => p.player_id)));
  const { data: fixedSlotPlayerProfilesRaw } = fixedSlotPlayerIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", fixedSlotPlayerIds)
    : { data: [] };
  const fixedSlotPlayerNameById = new Map(
    ((fixedSlotPlayerProfilesRaw ?? []) as Array<{ user_id: string; name: string | null }>).map((p) => [
      p.user_id,
      p.name?.trim() || "Jugador",
    ])
  );
  const fixedSlotPlayersById = new Map<string, Array<{ playerId: string; name: string }>>();
  for (const p of fixedSlotPlayersToday) {
    const list = fixedSlotPlayersById.get(p.fixed_slot_id) ?? [];
    list.push({ playerId: p.player_id, name: fixedSlotPlayerNameById.get(p.player_id) ?? "Jugador" });
    fixedSlotPlayersById.set(p.fixed_slot_id, list);
  }

  const { data: refundRequestedRaw } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.payments)
        .select("id,matches!inner(court_id)")
        .eq("status", "refund_requested")
        .in("matches.court_id", ctx.courtIds)
    : { data: [] };
  const refundRequestedCount = (refundRequestedRaw ?? []).length;

  const { data: cancelledTodayRaw } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.matches)
        .select("id")
        .in("court_id", ctx.courtIds)
        .eq("scheduled_date", today)
        .eq("match_status", "cancelled")
    : { data: [] };
  const cancelledTodayCount = (cancelledTodayRaw ?? []).length;

  // Pagos confirmados hoy — límite de "hoy" anclado a medianoche ART (no a
  // medianoche del huso del server), igual criterio que el resto de la página.
  const todayStartIso = new Date(utcMsForArgentinaWallClock(today, "00:00")).toISOString();
  const { data: paymentsTodayRaw } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.payments)
        .select("id,amount,status,matches!inner(court_id)")
        .in("matches.court_id", ctx.courtIds)
        .gte("created_at", todayStartIso)
    : { data: [] };
  const paymentsToday = (paymentsTodayRaw ?? []) as Array<{
    id: string;
    amount: number | null;
    status: string | null;
  }>;
  const approvedPaymentsToday = paymentsToday.filter((p) => String(p.status ?? "").toLowerCase() === "approved");
  const paidAmountToday = approvedPaymentsToday.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const paidCountToday = approvedPaymentsToday.length;
  const pendingPaymentsCountToday = paymentsToday.filter(
    (p) => String(p.status ?? "").toLowerCase() === "pending"
  ).length;

  const { data: nextMatchRaw } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.matches)
        .select("id,owner_id,court_id,payment_status,scheduled_time,courts(name),match_status")
        .in("court_id", ctx.courtIds)
        .eq("scheduled_date", today)
        .neq("match_status", "cancelled")
        .order("scheduled_time", { ascending: true })
        .limit(20)
    : { data: [] };
  const nextMatchRows = (nextMatchRaw ?? []) as Array<{
    id: string;
    owner_id: string | null;
    court_id: string;
    payment_status: string | null;
    scheduled_time: string | null;
    courts: { name: string | null } | { name: string | null }[] | null;
    match_status: string | null;
  }>;
  const nextMatch =
    nextMatchRows.find((m) => {
      const min = timeToMinutes(m.scheduled_time);
      return min >= arNow.minutes;
    }) ?? null;

  // Owners de reservas de hoy (no turno fijo) — se necesitan para la grilla
  // cronológica ("nombre del jugador" en cada bloque de reserva), además del
  // owner del próximo turno.
  const reservaOwnerIdsToday = todayMatches
    .filter((m) => !m.es_turno_fijo && String(m.match_status ?? "").toLowerCase() !== "cancelled")
    .map((m) => m.owner_id)
    .filter((id): id is string => Boolean(id));
  const ownerIdsForNext = Array.from(
    new Set([nextMatch?.owner_id, ...reservaOwnerIdsToday].filter((id): id is string => Boolean(id)))
  );
  const { data: nextOwnerProfileRaw } = ownerIdsForNext.length
    ? await supabase
        .from(DB_TABLES.profiles)
        .select("user_id,name")
        .in("user_id", ownerIdsForNext)
    : { data: [] };
  const ownerNameById = new Map(
    ((nextOwnerProfileRaw ?? []) as Array<{ user_id: string; name: string | null }>).map((p) => [
      p.user_id,
      p.name?.trim() || "Jugador",
    ])
  );

  const { data: participantsTodayRaw } = todayMatchIds.length
    ? await supabase
        .from(DB_TABLES.matchParticipants)
        .select("match_id,player_id,attendance_status")
        .in("match_id", todayMatchIds)
    : { data: [] };
  const participantsToday = (participantsTodayRaw ?? []) as Array<{
    match_id: string;
    player_id: string;
    attendance_status: string | null;
  }>;

  const todayFixedSlotCards: TodayFixedSlotCard[] = fixedSlotsToday.map((slot) => {
    const match = matchByFixedSlotId.get(slot.id) ?? null;
    const matchParticipants = match ? participantsToday.filter((p) => p.match_id === match.id) : [];
    const allConfirmed =
      matchParticipants.length > 0 && matchParticipants.every((p) => p.attendance_status === "confirmed");
    return {
      id: slot.id,
      title: slot.title?.trim() || "Turno fijo",
      courtName: ctx.courts.find((c) => c.id === slot.court_id)?.name ?? "Cancha",
      time: String(slot.start_time ?? "").slice(0, 5),
      matchId: match?.id ?? null,
      players: fixedSlotPlayersById.get(slot.id) ?? [],
      allConfirmed,
      excepted: exceptedFixedSlotIdsToday.has(slot.id),
      todayYmd: today,
    };
  });

  const participantIds = Array.from(new Set(participantsToday.map((p) => p.player_id)));
  const { data: participantPaymentsRaw } = participantIds.length && todayMatchIds.length
    ? await supabase
        .from(DB_TABLES.payments)
        .select("match_id,user_id,status")
        .in("match_id", todayMatchIds)
        .in("user_id", participantIds)
    : { data: [] };
  const participantPayments = (participantPaymentsRaw ?? []) as Array<{
    match_id: string;
    user_id: string;
    status: string | null;
  }>;
  const paymentMap = new Map<string, string>();
  for (const pay of participantPayments) {
    paymentMap.set(`${pay.match_id}:${pay.user_id}`, String(pay.status ?? "").toLowerCase());
  }

  const occupiedNowCount = new Set(
    todayMatches
      .filter((m) => {
        if (String(m.match_status ?? "").toLowerCase() === "cancelled") return false;
        const start = timeToMinutes(m.scheduled_time);
        if (start < 0) return false;
        return arNow.minutes >= start && arNow.minutes < start + 90;
      })
      .map((m) => m.court_id)
  ).size;
  const totalCourts = ctx.courtIds.length;
  const occupiedPct = totalCourts > 0 ? Math.round((occupiedNowCount / totalCourts) * 100) : 0;

  const reservationMatchesToday = todayMatches.filter(
    (m) => m.match_type === "reservation" && String(m.match_status ?? "").toLowerCase() !== "cancelled"
  );
  const reservasHoy = reservationMatchesToday.length;
  const reservasPagadas = reservationMatchesToday.filter(
    (m) => String(m.payment_status ?? "").toLowerCase() === "paid"
  ).length;
  const reservasPendientes = Math.max(0, reservasHoy - reservasPagadas);

  const turnosFijosHoy = todayMatches.filter((m) => Boolean(m.es_turno_fijo)).length;
  let turnosFijosConfirmados = 0;
  let turnosFijosSinConfirmar = 0;
  for (const part of participantsToday) {
    const match = todayMatches.find((m) => m.id === part.match_id);
    if (!match || !match.es_turno_fijo) continue;
    const status = paymentMap.get(`${part.match_id}:${part.player_id}`) ?? "";
    if (status === "approved") turnosFijosConfirmados += 1;
    else turnosFijosSinConfirmar += 1;
  }

  const reservasSinPagoHoyAlert = reservasPendientes;
  const turnosFijosSinConfirmarAlert = turnosFijosSinConfirmar;

  const ownerIdsWeek = Array.from(
    new Set(
      todayMatches
        .filter((m) => String(m.scheduled_date ?? "") >= weekAgo)
        .map((m) => m.owner_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const { data: newPlayersWeekRaw } = ownerIdsWeek.length
    ? await supabase
        .from(DB_TABLES.profiles)
        .select("user_id")
        .in("user_id", ownerIdsWeek)
        .gte("created_at", `${weekAgo}T00:00:00`)
    : { data: [] };
  const newPlayersWeekCount = (newPlayersWeekRaw ?? []).length;

  const clubOnboardingCompletedFromDb = Boolean(club?.onboarding_completed);
  const onboardingStatus = club?.id ? await checkOnboardingStatus(supabase, club.id) : null;
  if (club?.id && onboardingStatus && !clubOnboardingCompletedFromDb && onboardingStatus.allCompleted) {
    await supabase
      .from(DB_TABLES.clubs)
      .update({ onboarding_completed: true })
      .eq("id", club.id)
      .eq("owner_id", ctx.userId);
  }
  const onboardingPhasesStatus = club?.id ? await checkAdminOnboardingStatus(supabase, club.id) : null;

  const criticalAlerts = [
    onboardingStatus && !onboardingStatus.hasMpConnected
      ? {
          key: "mp_not_connected",
          text: "Para recibir reservas online necesitás conectar tu cuenta de Mercado Pago para poder recibir el dinero de tus clientes.",
          href: "/admin/config/pagos",
          cta: "Conectar ahora",
        }
      : null,
    refundRequestedCount > 0
      ? {
          key: "refunds",
          text: `${refundRequestedCount} reembolsos esperando tu aprobación`,
          href: "/admin/finanzas/reembolsos",
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; text: string; href: string; cta?: string }>;

  const importantAlerts = [
    reservasSinPagoHoyAlert > 0
      ? {
          key: "pending_today",
          text: `${reservasSinPagoHoyAlert} reservas de hoy sin pago confirmado`,
          href: `/admin/reservas?date=${today}`,
        }
      : null,
    turnosFijosSinConfirmarAlert > 0
      ? {
          key: "fixed_slots",
          text: `${turnosFijosSinConfirmarAlert} jugadores no confirmaron su turno de hoy`,
          href: "/admin/turnos-fijos",
        }
      : null,
    cancelledTodayCount > 0
      ? {
          key: "cancelled_today",
          text: `${cancelledTodayCount} cancelaciones registradas hoy`,
          href: "/admin/reservas",
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; text: string; href: string }>;

  const infoAlerts = [
    newPlayersWeekCount > 0
      ? {
          key: "new_players_week",
          text: `${newPlayersWeekCount} jugadores nuevos se sumaron esta semana`,
          href: "/admin/jugadores",
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; text: string; href: string }>;

  const totalAlerts = criticalAlerts.length + importantAlerts.length + infoAlerts.length;
  const nextCourtRel = Array.isArray(nextMatch?.courts) ? nextMatch?.courts[0] : nextMatch?.courts;
  const nextOwnerName = nextMatch?.owner_id ? ownerNameById.get(nextMatch.owner_id) ?? "Jugador" : "Jugador";
  const nextPayStatus = String(nextMatch?.payment_status ?? "").toLowerCase();
  const nextPayLabel =
    nextPayStatus === "paid" || nextPayStatus === "approved"
      ? "Pagado"
      : nextPayStatus === "pending"
        ? "Pendiente"
        : "Sin confirmar";

  // --- Vista cronológica del día: franjas abiertas por cancha + eventos ---
  const dashboardCourts = ctx.courts.map((c) => ({ id: c.id, name: c.name ?? "Cancha" }));
  const dashboardTimelineData = await buildDashboardTimelineData(
    supabase,
    dashboardCourts,
    ctx.courtIds,
    ctx.clubIds,
    club ? { open_time: club.open_time ?? null, close_time: club.close_time ?? null } : null,
    today
  );

  return (
    <div className="flex flex-col gap-6">
      {subscriptionActivated ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-100 p-4 text-sm font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          ¡Suscripción activada! Bienvenido a PadeLibre.
        </div>
      ) : null}
      {onboardingPhasesStatus && !onboardingPhasesStatus.allComplete ? (
        <OnboardingChecklist status={onboardingPhasesStatus} />
      ) : null}
      <section className="px-1 pt-2">
        <h1 className="font-admin-display text-[28px] font-bold text-[var(--text-primary)]">Hola, {clubName} 👋</h1>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-[var(--text-secondary)]">
          <span>{weekdayDateLabel}</span>
          <span aria-hidden="true">·</span>
          <CurrentArTime />
        </div>
        {clubSlug ? <DashboardClubLink slug={clubSlug} /> : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/reservas" className={`${adminCard} space-y-2 transition hover:-translate-y-0.5 hover:shadow-md`}>
          <div className="flex items-start justify-between gap-3">
            <p className={metricKicker}>Canchas ocupadas ahora</p>
            <MapPin size={20} className="shrink-0 text-[#0085FC]" />
          </div>
          <p className="text-4xl font-bold font-admin-display text-[var(--text-primary)]">
            {occupiedNowCount} <span className="text-base font-semibold text-[var(--text-secondary)]">de {totalCourts}</span>
          </p>
          <p className="text-sm text-[var(--text-secondary)]">canchas en uso ahora</p>
        </Link>
        <Link href="/admin/reservas" className={`${adminCard} space-y-2 transition hover:-translate-y-0.5 hover:shadow-md`}>
          <div className="flex items-start justify-between gap-3">
            <p className={metricKicker}>Reservas hoy</p>
            <CalendarCheck size={20} className="shrink-0 text-[#0085FC]" />
          </div>
          <p className="text-4xl font-bold font-admin-display text-[var(--text-primary)]">{reservasHoy}</p>
          <p className="text-sm text-[var(--text-secondary)]">
            {reservasPagadas} pagadas · {reservasPendientes} pendientes
          </p>
        </Link>
        <Link href="/admin/turnos-fijos" className={`${adminCard} space-y-2 transition hover:-translate-y-0.5 hover:shadow-md`}>
          <div className="flex items-start justify-between gap-3">
            <p className={metricKicker}>Turnos fijos hoy</p>
            <Clock size={20} className="shrink-0 text-[#0085FC]" />
          </div>
          <p className="text-4xl font-bold font-admin-display text-[var(--text-primary)]">{Math.max(fixedSlotsTodayCount, turnosFijosHoy)}</p>
          <p className="text-sm text-[var(--text-secondary)]">
            {turnosFijosConfirmados} confirmados · {turnosFijosSinConfirmar} sin confirmar
          </p>
        </Link>
        <Link href="/admin/finanzas" className={`${adminCard} space-y-2 transition hover:-translate-y-0.5 hover:shadow-md`}>
          <div className="flex items-start justify-between gap-3">
            <p className={metricKicker}>Pagos confirmados hoy</p>
            <DollarSign size={20} className="shrink-0 text-[#0085FC]" />
          </div>
          <p className="text-4xl font-bold font-admin-display text-[var(--text-primary)]">
            ${paidAmountToday.toLocaleString("es-AR")}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            {paidCountToday} aprobados · {pendingPaymentsCountToday} pendientes
          </p>
        </Link>
      </section>

      {totalAlerts > 0 ? (
        <section className="space-y-3">
          <h2 className="font-admin-display text-lg font-bold text-[var(--text-primary)]">Alertas</h2>
          <div className="space-y-2">
            {criticalAlerts.map((a) => (
              <Link
                key={a.key}
                href={a.href}
                className="flex items-center justify-between gap-3 rounded-xl p-4 text-sm font-semibold text-[var(--text-primary)] transition hover:-translate-y-0.5 hover:shadow-sm"
                style={{ borderLeft: "3px solid #EF4444", backgroundColor: "rgba(239,68,68,0.06)" }}
              >
                <span>{a.text}</span>
                {a.cta ? (
                  <span className="shrink-0 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">
                    {a.cta}
                  </span>
                ) : (
                  <ChevronRight size={16} />
                )}
              </Link>
            ))}
            {importantAlerts.map((a) => (
              <Link
                key={a.key}
                href={a.href}
                className="flex items-center justify-between rounded-xl p-4 text-sm font-semibold text-[var(--text-primary)] transition hover:-translate-y-0.5 hover:shadow-sm"
                style={{ borderLeft: "3px solid #F59E0B", backgroundColor: "rgba(245,158,11,0.06)" }}
              >
                <span>{a.text}</span>
                <ChevronRight size={16} />
              </Link>
            ))}
            {infoAlerts.map((a) => (
              <Link
                key={a.key}
                href={a.href}
                className="flex items-center justify-between rounded-xl p-4 text-sm font-semibold text-[var(--text-primary)] transition hover:-translate-y-0.5 hover:shadow-sm"
                style={{ borderLeft: "3px solid #0085FC", backgroundColor: "rgba(0,133,252,0.06)" }}
              >
                <span>{a.text}</span>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <DashboardClient todayYmd={today} courts={dashboardCourts} initialData={dashboardTimelineData} />

      {nextMatch ? (
        <section className={`${adminCard} flex flex-wrap items-center justify-between gap-4`}>
          <div>
            <p className={adminKicker}>Próximo turno</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-admin-display text-2xl font-bold text-[var(--text-primary)]">
                {String(nextMatch.scheduled_time ?? "").slice(0, 5)} hs
              </p>
              <p className="text-sm text-[var(--text-secondary)]">{nextCourtRel?.name ?? "Cancha"}</p>
              <p className="text-sm text-[var(--text-secondary)]">{nextOwnerName}</p>
            </div>
          </div>
          <PaymentStatusPill status={nextPayStatus} />
        </section>
      ) : null}

      {todayFixedSlotCards.length > 0 ? (
        <section className="space-y-3">
          <p className={adminKicker}>Turnos fijos hoy</p>
          <div className="space-y-2">
            {todayFixedSlotCards.map((card) => (
              <FixedSlotTodayCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      ) : null}

      <SuperadminEntryLink variant="admin" />
    </div>
  );
}
