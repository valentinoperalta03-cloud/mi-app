import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  LayoutGrid,
  Settings,
  ShieldAlert,
  SquareChartGantt,
  Trophy,
  GraduationCap,
  Users,
  Wallet,
} from "lucide-react";
import { adminBadgeLima, adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import OnboardingChecklist from "@/components/admin/onboarding-checklist";
import SuperadminEntryLink from "@/components/superadmin/superadmin-entry-link";
import { formatDateInArgentina, getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { checkOnboardingStatus } from "@/lib/admin/onboarding-check";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import CurrentArTime from "./current-ar-time";

const quickActions: Array<{
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { href: "/admin/torneos", label: "Torneos", description: "Americanos, llaves y peñas", icon: Trophy },
  { href: "/admin/clases", label: "Clases", description: "Prácticas y entrenamientos", icon: GraduationCap },
  { href: "/admin/reservas", label: "Reservas", description: "Gestioná agenda y pagos", icon: CalendarDays },
  { href: "/admin/finanzas", label: "Finanzas", description: "Controlá ingresos y egresos", icon: Wallet },
  { href: "/admin/agenda", label: "Ocupación", description: "Estado de canchas y horarios", icon: SquareChartGantt },
  { href: "/admin/jugadores", label: "Jugadores", description: "Actividad y retención", icon: Users },
  { href: "/admin/canchas", label: "Canchas", description: "Configuración de canchas", icon: Building2 },
  { href: "/admin/club", label: "Club", description: "Datos y branding del club", icon: CircleDollarSign },
  { href: "/admin/turnos-fijos", label: "Turnos Fijos", description: "Gestión semanal fija", icon: Clock3 },
  { href: "/admin/config", label: "Config", description: "Preferencias y permisos", icon: Settings },
];

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
  const todayDateLabel = formatDateInArgentina(`${today}T12:00:00`, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const weekAgoDate = new Date(`${today}T12:00:00`);
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const weekAgo = weekAgoDate.toISOString().slice(0, 10);

  const { data: clubInfoRaw } = await supabase
    .from(DB_TABLES.clubs)
    .select("id,name,logo_url,onboarding_completed")
    .in("id", ctx.clubIds)
    .order("name", { ascending: true })
    .limit(1);
  const club = ((clubInfoRaw ?? [])[0] ?? null) as
    | { id: string; name: string | null; logo_url: string | null; onboarding_completed?: boolean | null }
    | null;
  const clubName = String(club?.name ?? "Mi club").trim() || "Mi club";
  const clubInitials = clubName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const { data: todayMatchesRaw } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.matches)
        .select("id,court_id,owner_id,payment_status,scheduled_time,scheduled_date,match_status,es_turno_fijo,courts(name)")
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
    es_turno_fijo: boolean | null;
    courts: { name: string | null } | { name: string | null }[] | null;
  }>;
  const todayMatchIds = todayMatches.map((m) => m.id);

  const { data: fixedSlotsTodayRaw } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.fixedSlots)
        .select("id")
        .in("court_id", ctx.courtIds)
        .eq("is_active", true)
        .eq("day_of_week", new Date(`${today}T12:00:00`).getDay())
    : { data: [] };
  const fixedSlotsTodayCount = (fixedSlotsTodayRaw ?? []).length;

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

  const ownerIdsForNext = Array.from(new Set([nextMatch?.owner_id].filter((id): id is string => Boolean(id))));
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
        .select("match_id,player_id")
        .in("match_id", todayMatchIds)
    : { data: [] };
  const participantsToday = (participantsTodayRaw ?? []) as Array<{ match_id: string; player_id: string }>;

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

  const reservasHoy = todayMatches.filter((m) => !Boolean(m.es_turno_fijo)).length;
  const reservasPagadas = todayMatches.filter(
    (m) => !Boolean(m.es_turno_fijo) && String(m.payment_status ?? "").toLowerCase() === "paid"
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
  const showOnboardingChecklist = Boolean(
    club?.id && onboardingStatus && !clubOnboardingCompletedFromDb && !onboardingStatus.allCompleted
  );

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

  return (
    <div className="flex flex-col gap-6">
      {subscriptionActivated ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-100 p-4 text-sm font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          ¡Suscripción activada! Bienvenido a PadeLibre.
        </div>
      ) : null}
      {showOnboardingChecklist && onboardingStatus ? (
        <OnboardingChecklist
          items={onboardingStatus.items}
          completedCount={onboardingStatus.completedCount}
          totalCount={onboardingStatus.totalCount}
          canReceiveReservations={onboardingStatus.canReceiveReservations}
          allCompleted={onboardingStatus.allCompleted}
        />
      ) : null}
      <section className="overflow-hidden rounded-2xl bg-brand-gradient p-4 shadow-[0_10px_30px_rgba(3,23,51,0.35)] md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            {club?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
              <img
                src={club.logo_url}
                alt={clubName}
                className="h-12 w-12 rounded-full border border-white/20 object-cover md:h-16 md:w-16 md:rounded-2xl"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0085FC] text-base font-bold text-white md:h-16 md:w-16 md:rounded-2xl md:text-xl">
                {clubInitials || "CL"}
              </div>
            )}
            <div>
              <h1 className="font-admin-display text-lg font-bold text-white md:text-2xl">{clubName}</h1>
              <p className="text-xs text-white/70 md:text-sm">{todayDateLabel}</p>
              <CurrentArTime className="text-[11px] text-white/50 md:text-xs" />
            </div>
          </div>
          <div
            className={
              totalAlerts > 0
                ? "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold bg-rose-500/20 text-rose-100 ring-1 ring-rose-300/40"
                : `inline-flex w-fit items-center ${adminBadgeLima}`
            }
          >
            {totalAlerts > 0 ? `🔴 ${totalAlerts} alertas pendientes` : "🟢 Todo en orden"}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Link href="/admin/reservas" className={`${adminCard} space-y-2 transition hover:-translate-y-0.5 hover:shadow-md`}>
          <p className={adminKicker}>Canchas ocupadas ahora</p>
          <p className="text-3xl font-bold text-[var(--text-primary)]">
            {occupiedNowCount} <span className="text-base font-semibold text-[var(--text-secondary)]">de {totalCourts}</span>
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
            <div className="h-full rounded-full bg-[#0085FC]" style={{ width: `${Math.max(0, Math.min(100, occupiedPct))}%` }} />
          </div>
        </Link>
        <Link href="/admin/reservas" className={`${adminCard} space-y-2 transition hover:-translate-y-0.5 hover:shadow-md`}>
          <p className={adminKicker}>Reservas hoy</p>
          <p className="text-3xl font-bold text-[var(--text-primary)]">{reservasHoy}</p>
          <p className="text-sm text-[var(--text-tertiary)]">
            {reservasPagadas} pagadas · {reservasPendientes} pendientes
          </p>
        </Link>
        <Link href="/admin/turnos-fijos" className={`${adminCard} space-y-2 transition hover:-translate-y-0.5 hover:shadow-md`}>
          <p className={adminKicker}>Turnos fijos hoy</p>
          <p className="text-3xl font-bold text-[var(--text-primary)]">{Math.max(fixedSlotsTodayCount, turnosFijosHoy)}</p>
          <p className="text-sm text-[var(--text-tertiary)]">
            {turnosFijosConfirmados} confirmados · {turnosFijosSinConfirmar} sin confirmar
          </p>
        </Link>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={17} className="text-rose-500" />
          <h2 className="font-admin-display text-lg font-bold text-[var(--text-primary)]">Alertas urgentes</h2>
        </div>

        {totalAlerts === 0 ? (
          <div className="rounded-xl border-l-[3px] border-[var(--admin-accent-lima)] bg-[var(--admin-accent-lima-subtle)] p-4 text-sm font-semibold text-[var(--admin-status-active-text)]">
            ✅ Sin alertas pendientes. Todo en orden.
          </div>
        ) : (
          <div className="space-y-2">
            {criticalAlerts.map((a) => (
              <Link
                key={a.key}
                href={a.href}
                className="flex items-center justify-between gap-3 rounded-xl border-l-[3px] border-[var(--admin-alert-error-border)] bg-[var(--admin-alert-error-bg)] p-4 text-sm font-semibold text-[var(--text-error)] transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <span>🔴 {a.text}</span>
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
                className="flex items-center justify-between rounded-xl border-l-[3px] border-[var(--admin-alert-warning-border)] bg-[var(--admin-alert-warning-bg)] p-4 text-sm font-semibold text-[var(--admin-alert-warning-text)] transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <span>🟠 {a.text}</span>
                <ChevronRight size={16} />
              </Link>
            ))}
            {infoAlerts.map((a) => (
              <Link
                key={a.key}
                href={a.href}
                className="flex items-center justify-between rounded-xl border-l-[3px] border-[#0085FC]/50 bg-[#0085FC]/5 p-4 text-sm font-semibold text-[#0461C4] transition hover:-translate-y-0.5 hover:shadow-sm dark:text-sky-300"
              >
                <span>🔵 {a.text}</span>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className={adminCard}>
        <p className={adminKicker}>Próximo turno</p>
        {nextMatch ? (
          <div className="mt-3 space-y-1">
            <p className="font-admin-display text-2xl font-bold text-[var(--text-primary)]">{String(nextMatch.scheduled_time ?? "").slice(0, 5)} hs</p>
            <p className="text-sm text-[var(--text-secondary)]">Cancha: {nextCourtRel?.name ?? "Cancha"}</p>
            <p className="text-sm text-[var(--text-secondary)]">Jugador: {nextOwnerName}</p>
            <p
              className={`text-sm font-semibold ${
                nextPayLabel === "Pagado" ? "text-[var(--admin-status-active-text)]" : "text-amber-700 dark:text-amber-400"
              }`}
            >
              Estado de pago: {nextPayLabel}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm font-semibold text-[var(--text-tertiary)]">No hay más turnos por hoy 🎾</p>
        )}
      </section>

      <section className="space-y-3">
        <SuperadminEntryLink variant="admin" />
        <div className="hidden md:block">
          <div className="flex items-center gap-2">
            <LayoutGrid size={16} className="text-[#0085FC]" />
            <h2 className="font-admin-display text-lg font-bold text-[var(--text-primary)]">Accesos rápidos</h2>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${adminCard} group admin-quick-card`}
              >
                <div className="flex items-start justify-between gap-3">
                  <item.icon size={22} className="text-[#0085FC]" />
                  <ChevronRight size={16} className="text-[var(--text-tertiary)] transition group-hover:text-[#0085FC]" />
                </div>
                <p className="mt-3 text-base font-bold text-[var(--text-primary)]">{item.label}</p>
                <p className="mt-1 text-sm text-[var(--text-tertiary)]">{item.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
