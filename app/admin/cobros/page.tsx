import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import AdminFlashMessage from "@/components/admin/admin-flash-message";
import AdminGuideBox from "@/components/admin/admin-guide-box";
import AdminPageHeader from "@/components/admin/admin-page-header";
import { adminAccentBar, adminCard, adminKicker, adminTip } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { AR_TIME_ZONE, formatDateInArgentina, getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, getAdminClient } from "@/utils/supabase/server";
import CobrosClient, { type ConfirmedItem, type PendingItem } from "./cobros-client";

function isYmdInArgentina(iso: string, ymd: string): boolean {
  return (
    new Intl.DateTimeFormat("en-CA", {
      timeZone: AR_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso)) === ymd
  );
}

function matchBadge(matchType: string | null, esTurnoFijo: boolean | null): "Reserva" | "Partido abierto" | "Turno fijo" {
  if (esTurnoFijo) return "Turno fijo";
  return String(matchType ?? "").toLowerCase() === "reservation" ? "Reserva" : "Partido abierto";
}

type PageProps = {
  searchParams?: Promise<{ error?: string; ok?: string }>;
};

export default async function AdminCobrosPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.courtIds.length) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-28 pt-6 md:px-8">
        <AdminBackLink />
        <p className="text-sm text-[var(--text-secondary)]">No hay canchas asignadas a tu club.</p>
      </div>
    );
  }

  const todayAr = getTodayYmdInArgentina();
  const admin = await getAdminClient();

  const { data: clubMatchRows } = await supabase
    .from(DB_TABLES.matches)
    .select("id")
    .in("court_id", ctx.courtIds);
  const clubMatchIds = (clubMatchRows ?? []).map((m: { id: string }) => m.id);

  const [
    { data: pendingMatchRows, error: pendErr },
    { data: practicePendingRows, error: practicePendErr },
    { data: tournamentPendingRows, error: tournamentPendErr },
    { data: payRows },
    { data: practiceApprovedRows },
  ] = await Promise.all([
    supabase
      .from(DB_TABLES.matches)
      .select(
        "id, owner_id, court_id, scheduled_time, total_price, amount_paid, amount_pending, payment_status, match_type, match_status, es_turno_fijo"
      )
      .in("court_id", ctx.courtIds)
      .eq("scheduled_date", todayAr)
      .in("payment_status", ["cash_pending", "transfer_pending", "pending"])
      .neq("match_status", "cancelled")
      .order("scheduled_time", { ascending: true }),
    supabase
      .from(DB_TABLES.practiceRegistrations)
      .select(
        "id, player_id, payment_status, payment_method, amount, practice_sessions!inner(session_date, start_time, practices!inner(title, club_id))"
      )
      .in("payment_status", ["cash_pending", "transfer_pending"])
      .eq("practice_sessions.session_date", todayAr)
      .in("practice_sessions.practices.club_id", ctx.clubIds)
      .order("registered_at", { ascending: true }),
    supabase
      .from(DB_TABLES.tournamentRegistrations)
      .select("id, player1_id, player2_id, tournament_id, payment_status, total_price, tournaments!inner(name, club_id)")
      .eq("payment_status", "pending")
      .is("mp_payment_id", null)
      .in("tournaments.club_id", ctx.clubIds),
    clubMatchIds.length > 0
      ? admin
          .from(DB_TABLES.payments)
          .select(
            "id, amount, updated_at, payment_method, match_id, user_id, matches!inner(court_id, scheduled_date, scheduled_time)"
          )
          .eq("status", "approved")
          .in("payment_method", ["cash", "transfer"])
          .in("match_id", clubMatchIds)
          .order("updated_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    supabase
      .from(DB_TABLES.practiceRegistrations)
      .select(
        "id, player_id, payment_status, payment_method, amount, confirmed_at, practice_sessions!inner(session_date, start_time, practices!inner(title, club_id))"
      )
      .eq("payment_status", "approved")
      .in("payment_method", ["cash", "transfer"])
      .eq("practice_sessions.session_date", todayAr)
      .in("practice_sessions.practices.club_id", ctx.clubIds)
      .order("confirmed_at", { ascending: false }),
  ]);

  type MatchPendingRow = {
    id: string;
    owner_id: string;
    court_id: string;
    scheduled_time: string | null;
    total_price: number | null;
    amount_paid: number | null;
    amount_pending: number | null;
    payment_status: string | null;
    match_type: string | null;
    match_status: string | null;
    es_turno_fijo: boolean | null;
  };
  const pendingMatchesRaw = (pendingMatchRows ?? []) as MatchPendingRow[];
  // Un partido abierto (amistoso) solo se muestra como "pendiente de cobro"
  // cuando ya esta confirmado (reserved) — antes de eso no tiene sentido
  // pedirle plata a nadie, todavia puede no completarse.
  const pendingMatches = pendingMatchesRaw.filter(
    (m) => String(m.match_type ?? "").toLowerCase() !== "amistoso" || String(m.match_status ?? "") === "reserved"
  );

  type PracticePendingRow = {
    id: string;
    player_id: string;
    payment_status: string;
    payment_method?: string | null;
    amount: number | null;
    practice_sessions: {
      session_date: string;
      start_time: string;
      practices: { title: string; club_id: string } | { title: string; club_id: string }[];
    } | {
      session_date: string;
      start_time: string;
      practices: { title: string; club_id: string } | { title: string; club_id: string }[];
    }[];
  };

  function parsePracticeReg(row: PracticePendingRow) {
    const s = Array.isArray(row.practice_sessions) ? row.practice_sessions[0] : row.practice_sessions;
    const p = s ? (Array.isArray(s.practices) ? s.practices[0] : s.practices) : null;
    return {
      id: row.id,
      player_id: row.player_id,
      payment_status: row.payment_status,
      payment_method: String(row.payment_method ?? "").toLowerCase(),
      amount: row.amount,
      session_date: s?.session_date ?? "",
      start_time: s?.start_time ?? "",
      title: p?.title ?? "Clase",
      club_id: p?.club_id ?? "",
    };
  }

  const practicePending = ((practicePendingRows ?? []) as PracticePendingRow[]).map(parsePracticeReg);
  const practiceApprovedToday = ((practiceApprovedRows ?? []) as PracticePendingRow[]).map(parsePracticeReg);

  type TournamentPendingRow = {
    id: string;
    player1_id: string;
    player2_id: string | null;
    tournament_id: string;
    payment_status: string;
    total_price: number | null;
    tournaments: { name: string; club_id: string } | { name: string; club_id: string }[] | null;
  };
  function parseTournamentReg(row: TournamentPendingRow) {
    const t = Array.isArray(row.tournaments) ? row.tournaments[0] : row.tournaments;
    return {
      id: row.id,
      player1_id: row.player1_id,
      player2_id: row.player2_id,
      total_price: row.total_price,
      tournamentName: t?.name ?? "Torneo",
    };
  }
  const tournamentPending = ((tournamentPendingRows ?? []) as TournamentPendingRow[]).map(parseTournamentReg);

  const courtName = new Map(ctx.courts.map((c) => [c.id, c.name ?? "Cancha"]));

  const paymentsAll = (payRows ?? []) as Array<{
    id: string;
    amount: number | null;
    updated_at: string | null;
    payment_method: string | null;
    user_id: string;
    match_id: string;
    matches:
      | { court_id: string; scheduled_date: string | null; scheduled_time: string | null }
      | { court_id: string; scheduled_date: string | null; scheduled_time: string | null }[]
      | null;
  }>;
  const paymentsToday = paymentsAll.filter((p) => {
    const rel = p.matches;
    const match = Array.isArray(rel) ? rel[0] ?? null : rel;
    if (!match) return false;
    const court = match.court_id;
    if (!court || !ctx.courtIds.includes(court)) return false;
    if (!p.updated_at) return false;
    return isYmdInArgentina(p.updated_at, todayAr);
  });

  const profileUserIds = [
    ...new Set(
      [
        ...pendingMatches.map((p) => p.owner_id),
        ...practicePending.map((p) => p.player_id),
        ...practiceApprovedToday.map((p) => p.player_id),
        ...paymentsToday.map((p) => p.user_id),
        ...tournamentPending.flatMap((t) => [t.player1_id, t.player2_id].filter(Boolean) as string[]),
      ].filter(Boolean)
    ),
  ];
  const { data: profs } = profileUserIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id, name").in("user_id", profileUserIds)
    : { data: [] };
  const playerName = new Map(
    ((profs ?? []) as Array<{ user_id: string; name: string | null }>).map((p) => [
      p.user_id,
      p.name?.trim() || "Jugador",
    ])
  );

  const pendingItems: PendingItem[] = [
    ...pendingMatches.map((m): PendingItem => {
      const totalPrice = Number(m.total_price ?? 0);
      const amountPaid = Number(m.amount_paid ?? 0);
      return {
        kind: "match",
        id: m.id,
        badge: matchBadge(m.match_type, m.es_turno_fijo),
        courtLabel: courtName.get(m.court_id) ?? "Cancha",
        time: String(m.scheduled_time ?? "").slice(0, 5),
        playerName: playerName.get(m.owner_id) ?? "Jugador",
        totalPrice,
        amountPaid,
        amountPending: Math.max(totalPrice - amountPaid, 0),
      };
    }),
    ...practicePending.map((pr): PendingItem => ({
      kind: "practice",
      id: pr.id,
      title: pr.title,
      time: pr.start_time.slice(0, 5),
      playerName: playerName.get(pr.player_id) ?? "Jugador",
      amount: Math.round(Number(pr.amount ?? 0)),
    })),
    ...tournamentPending.map((t): PendingItem => {
      const p1 = playerName.get(t.player1_id) ?? "Jugador";
      const p2 = t.player2_id ? playerName.get(t.player2_id) ?? "Jugador" : null;
      return {
        kind: "tournament",
        id: t.id,
        tournamentName: t.tournamentName,
        playerName: p2 ? `${p1} / ${p2}` : p1,
        amount: Math.round(Number(t.total_price ?? 0)),
      };
    }),
  ];

  const confirmedItems: ConfirmedItem[] = [
    ...paymentsToday.map((p): ConfirmedItem => {
      const rel = p.matches;
      const match = Array.isArray(rel) ? rel[0] ?? null : rel;
      return {
        kind: "match",
        id: p.id,
        label: courtName.get(match?.court_id ?? "") ?? "Cancha",
        time: String(match?.scheduled_time ?? "").slice(0, 5),
        playerName: playerName.get(p.user_id) ?? "Jugador",
        amount: Number(p.amount ?? 0),
        method: p.payment_method === "cash" ? "cash" : p.payment_method === "transfer" ? "transfer" : null,
      };
    }),
    ...practiceApprovedToday.map((pr): ConfirmedItem => ({
      kind: "practice",
      id: pr.id,
      label: pr.title,
      time: pr.start_time.slice(0, 5),
      playerName: playerName.get(pr.player_id) ?? "Jugador",
      amount: Number(pr.amount ?? 0),
      method: pr.payment_method === "cash" ? "cash" : pr.payment_method === "transfer" ? "transfer" : null,
    })),
  ];

  const totalCobradoHoy = confirmedItems.reduce((s, c) => s + c.amount, 0);
  const totalEfectivo = confirmedItems.filter((c) => c.method === "cash").reduce((s, c) => s + c.amount, 0);
  const totalTransferencia = confirmedItems.filter((c) => c.method === "transfer").reduce((s, c) => s + c.amount, 0);

  const err = sp.error ? decodeURIComponent(sp.error) : "";
  const ok = sp.ok === "1";

  return (
    <div className="flex flex-col gap-5">
      <AdminBackLink />
      <AdminPageHeader
        kicker="Registro diario"
        title="Cobros y pagos"
        subtitle={`Hoy, ${formatDateInArgentina(`${todayAr}T12:00:00`)}`}
      />

      {ok ? <AdminFlashMessage type="success" message="Actualizado correctamente." /> : null}
      {err ? <AdminFlashMessage type="error" message={err} /> : null}
      {pendErr ? <AdminFlashMessage type="error" message={`No se pudieron cargar los pendientes: ${pendErr.message}`} /> : null}
      {practicePendErr ? (
        <AdminFlashMessage type="error" message={`No se pudieron cargar clases pendientes: ${practicePendErr.message}`} />
      ) : null}
      {tournamentPendErr ? (
        <AdminFlashMessage type="error" message={`No se pudieron cargar torneos pendientes: ${tournamentPendErr.message}`} />
      ) : null}

      <AdminGuideBox title="¿Cómo funciona Cobros y pagos?">
        <div>
          <p className="font-bold text-[var(--text-primary)]">¿Qué aparece acá?</p>
          <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">
            Todo lo que el club cobra en persona: reservas, partidos abiertos confirmados, turnos fijos, clases y
            torneos con pago en efectivo o transferencia. Los pagos con Mercado Pago se confirman automáticamente y
            no requieren acción acá.
          </p>
        </div>
        <div>
          <p className="font-bold text-[var(--text-primary)]">Pago parcial</p>
          <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">
            Con <strong>$ Registrar pago</strong> podés cargar el monto exacto que te entregó el jugador. Si todavía
            queda saldo, el turno sigue apareciendo en pendientes con el restante actualizado. Si el monto cubre el
            total, el cobro se cierra solo.
          </p>
        </div>
        <div className={adminTip}>
          <span className="font-bold">Consejo:</span> Usá <strong>Pagaron todo ✓</strong> cuando te entregan el
          importe completo de una sola vez — es más rápido que abrir el formulario de pago parcial.
        </div>
      </AdminGuideBox>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={adminCard}>
          <p className={adminKicker}>Pendientes</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
            {pendingItems.length}
          </p>
          <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">de cobro hoy</p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Confirmados</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {confirmedItems.length}
          </p>
          <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">efectivo y transferencia</p>
        </div>
        <div className={`${adminCard} ${adminAccentBar}`}>
          <p className={adminKicker}>Total cobrado</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-[var(--text-primary)]">
            ${totalCobradoHoy.toLocaleString("es-AR")}
          </p>
          <p className="mt-2 space-y-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
            <span className="block">💵 Efectivo: ${totalEfectivo.toLocaleString("es-AR")}</span>
            <span className="block">🏦 Transferencia: ${totalTransferencia.toLocaleString("es-AR")}</span>
          </p>
        </div>
      </section>

      <CobrosClient pendingItems={pendingItems} confirmedItems={confirmedItems} todayLabel={todayAr} />
    </div>
  );
}
