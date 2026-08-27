import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft } from "lucide-react";
import { FinancialStatusPill } from "@/components/admin/admin-status-pills";
import {
  adminAccentBar,
  adminBadgeError,
  adminBadgeLima,
  adminBadgeNeutral,
  adminBadgePending,
  adminCard,
  adminCTADangerCompact,
  adminCTAPrimary,
  adminKicker,
  adminTitle,
} from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { calculateDepositAmount } from "@/lib/deposit-utils";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import {
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_TYPE_OPTIONS,
} from "@/lib/tournament-constants";
import { TournamentRealtimeRefresh } from "@/components/tournament-realtime-refresh";
import { CopyLinkButton } from "@/components/copy-link-button";
import {
  buildAmericanoRanking,
  type MatchForRanking,
} from "@/lib/tournament/ranking";
import {
  cancelRegistrationAction,
  cancelTournamentFormAction,
  finishTournamentFormAction,
  saveTournamentMatchFormAction,
  startTournamentFormAction,
  updatePenaMatchPairsAction,
} from "./actions";
import { FINAL_ROUND } from "@/lib/tournament/rounds";
import { AmericanoLeaderboard } from "./AmericanoLeaderboard";
import { ConfirmActionButton } from "./confirm-action-button";
import { ReorderRegistrations } from "./reorder-registrations";
import { TournamentScheduler } from "./TournamentScheduler";
import type { EditableTournament } from "./edit-tournament-form";
import TournamentConfigSection from "./tournament-config-section";
import { WinnerPickerButtons } from "./winner-picker-buttons";

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

type AdminWhatsAppTournamentInfo = {
  id: string;
  name: string;
  tournament_type: string;
  start_date: string;
  start_time: string;
  price_per_pair: number;
  max_pairs: number;
  allowed_categories: string[] | null;
  guaranteed_matches: number | null;
  prizes: Array<{ position: number; description: string }> | null;
  match_format: string | null;
  match_duration_minutes: number | null;
  club_name: string | null;
};

const ADMIN_WHATSAPP_TIPO_LABELS: Record<string, string> = {
  americano: "AMERICANO",
  eliminacion: "ELIMINACIÓN DIRECTA",
  pena: "PEÑA",
};

function buildAdminWhatsAppMessage(torneo: AdminWhatsAppTournamentInfo, siteUrl: string): string {
  const tipo = ADMIN_WHATSAPP_TIPO_LABELS[torneo.tournament_type] ?? torneo.tournament_type.toUpperCase();
  const cats = torneo.allowed_categories;
  const catLabel = cats?.length ? cats.join(" · ") : "TODAS LAS CATEGORÍAS";
  const nombre = torneo.name.toUpperCase();

  const lines: string[] = [];

  lines.push(`🏆 ${nombre} - ${tipo} ${catLabel} 🏆`);
  lines.push("");

  if (torneo.start_date) {
    const fecha = format(parseISO(torneo.start_date), "EEEE d 'de' MMMM", { locale: es });
    lines.push(`📅 Día: ${fecha.charAt(0).toUpperCase() + fecha.slice(1)}`);
  }
  if (torneo.start_time) {
    lines.push(`🕐 Horario: ${String(torneo.start_time).slice(0, 5)}hs`);
  }

  if (torneo.club_name) {
    lines.push(`📍 Lugar: ${torneo.club_name}`);
  }

  if (torneo.match_format) {
    const formatLabel =
      torneo.match_format === "set"
        ? "1 set"
        : torneo.match_format === "tres_sets"
          ? "Al mejor de 3 sets"
          : torneo.match_format === "tiempo"
            ? `${torneo.match_duration_minutes ?? 20} minutos`
            : torneo.match_format;
    lines.push(`🎾 Metodología: ${formatLabel}`);
  }

  if (torneo.guaranteed_matches) {
    lines.push(`⚡ Partidos garantizados: ${torneo.guaranteed_matches} por pareja`);
  }

  if (torneo.prizes?.length) {
    lines.push("");
    lines.push("🏅 Premios:");
    for (const p of torneo.prizes) {
      const emoji = p.position === 1 ? "🥇" : p.position === 2 ? "🥈" : p.position === 3 ? "🥉" : "🏅";
      lines.push(`   ${emoji} ${p.position}° puesto: ${p.description}`);
    }
  }

  if (torneo.price_per_pair > 0) {
    lines.push("");
    lines.push(`💰 Inscripción: $${Number(torneo.price_per_pair).toLocaleString("es-AR")} por pareja`);
  }

  if (torneo.max_pairs > 0) {
    lines.push(`👥 Cupos: ${torneo.max_pairs} parejas`);
  }

  lines.push("");
  lines.push("📲 Inscribite acá:");
  lines.push(`${siteUrl}/torneos/${torneo.id}`);

  return lines.join("\n");
}

export default async function AdminTorneoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: t } = await supabase
    .from(DB_TABLES.tournaments)
    .select(
      "id, club_id, name, description, tournament_type, status, max_pairs, price_per_pair, requires_deposit, deposit_type, deposit_value, prize, start_date, end_date, start_time, registration_deadline, cancellation_hours, category_min, category_max, group_chat_id, consolation_bracket, what_includes, game_format, is_individual, allowed_categories, has_finals, match_format, match_duration_minutes, multi_day, num_courts, food_included, contact_phone, prizes, guaranteed_matches, clubs(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!t) redirect("/admin/torneos");
  const tour = t as {
    club_id: string;
    name: string;
    description: string | null;
    tournament_type: string;
    status: string;
    max_pairs: number;
    price_per_pair: number;
    requires_deposit: boolean;
    deposit_type: "percentage" | "fixed" | null;
    deposit_value: number;
    prize: string | null;
    start_date: string;
    end_date: string;
    start_time: string;
    registration_deadline: string;
    cancellation_hours: number;
    category_min: number | null;
    category_max: number | null;
    group_chat_id: string | null;
    consolation_bracket: boolean;
    what_includes: string[] | null;
    game_format: string | null;
    is_individual: boolean;
    allowed_categories: string[] | null;
    has_finals: boolean | null;
    match_format: string | null;
    match_duration_minutes: number | null;
    multi_day: boolean | null;
    num_courts: number | null;
    food_included: string | null;
    contact_phone: string | null;
    prizes: Array<{ position: number; description: string }> | null;
    guaranteed_matches: number | null;
    clubs: { name: string | null } | { name: string | null }[] | null;
  };
  if (!ctx.clubIds.includes(tour.club_id)) redirect("/admin/torneos");

  const clubNameRow = Array.isArray(tour.clubs) ? (tour.clubs[0] ?? null) : tour.clubs;
  const clubName = clubNameRow?.name ?? null;

  const service = createServiceClient();
  const [{ data: regs }, { data: matches }, { data: courts }] =
    await Promise.all([
      service
        .from(DB_TABLES.tournamentRegistrations)
        .select(
          "id, player1_id, player2_id, payment_status, waitlist, registered_at, registration_order, financial_status, amount_paid, amount_pending",
        )
        .eq("tournament_id", id)
        .order("registration_order", { ascending: true })
        .order("registered_at", { ascending: true }),
      service
        .from(DB_TABLES.tournamentMatches)
        .select(
          "id, round, round_name, bracket, pair1_id, pair2_id, pair1_score, pair2_score, status, winner_pair_id, court_id, scheduled_date, scheduled_time, notes",
        )
        .eq("tournament_id", id)
        .order("round", { ascending: true }),
      service
        .from(DB_TABLES.courts)
        .select("id, name")
        .eq("club_id", tour.club_id)
        .order("name", { ascending: true }),
    ]);

  const regList = (regs ?? []) as Array<{
    id: string;
    player1_id: string;
    player2_id: string | null;
    payment_status: string;
    waitlist: boolean;
    registration_order: number | null;
    financial_status: string | null;
    amount_paid: number | null;
    amount_pending: number | null;
  }>;
  const playerIds = [
    ...new Set(
      regList.flatMap(
        (r) => [r.player1_id, r.player2_id].filter(Boolean) as string[],
      ),
    ),
  ];
  const { data: profiles } = playerIds.length
    ? await service
        .from(DB_TABLES.profiles)
        .select("user_id, name, avatar_url")
        .in("user_id", playerIds)
    : { data: [] };
  const profileMap = new Map(
    (
      (profiles ?? []) as Array<{
        user_id: string;
        name: string | null;
        avatar_url: string | null;
      }>
    ).map((p) => [p.user_id, p]),
  );

  const pairNameMap = new Map<string, string>();
  for (const r of regList) {
    const p1 = profileMap.get(r.player1_id)?.name ?? "Jugador";
    const p2 = r.player2_id
      ? (profileMap.get(r.player2_id)?.name ?? "Jugador")
      : null;
    pairNameMap.set(r.id, p2 ? `${p1} / ${p2}` : p1);
  }

  const typeBadge =
    TOURNAMENT_TYPE_OPTIONS.find((o) => o.value === tour.tournament_type)
      ?.badge ?? tour.tournament_type;
  const approved = regList.filter(
    (r) => r.payment_status === "approved" && !r.waitlist,
  );
  const waitlist = regList.filter((r) => r.waitlist);
  const pending = regList.filter((r) => r.payment_status === "pending");

  const courtList = (courts ?? []) as Array<{ id: string; name: string }>;

  const matchRows = (matches ?? []) as Array<{
    id: string;
    round: number;
    round_name: string | null;
    bracket: "gold" | "silver" | null;
    pair1_id: string | null;
    pair2_id: string | null;
    pair1_score: number | null;
    pair2_score: number | null;
    status: string;
    winner_pair_id: string | null;
    court_id: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    notes: string | null;
  }>;
  type MatchRow = (typeof matchRows)[number];
  const goldMatches = matchRows.filter((m) => (m.bracket ?? "gold") === "gold");
  const silverMatches = matchRows.filter((m) => m.bracket === "silver");
  const americanoRegularMatches = matchRows.filter(
    (m) => m.round < FINAL_ROUND,
  );
  const americanoFinalMatches = matchRows.filter((m) => m.round >= FINAL_ROUND);
  const useWinnerPicker =
    tour.tournament_type === "americano" && tour.match_format === "tiempo";

  function matchCard(m: MatchRow) {
    return (
      <li key={m.id} className={`${adminCard} text-sm`}>
        <p className="text-xs font-semibold text-[var(--text-tertiary)]">
          Ronda {m.round} · {m.round_name ?? "—"}
        </p>
        <p className="mt-1 text-[var(--text-secondary)]">
          {m.pair1_id ? (pairNameMap.get(m.pair1_id) ?? "Pareja 1") : "—"} vs{" "}
          {m.pair2_id ? (pairNameMap.get(m.pair2_id) ?? "Pareja 2") : "—"}
        </p>
        <span
          className={`mt-1 inline-flex ${
            m.status === "finished"
              ? adminBadgeLima
              : m.status === "in_progress"
                ? adminBadgePending
                : adminBadgeNeutral
          }`}
        >
          {m.status === "finished"
            ? "✓ Finalizado"
            : m.status === "in_progress"
              ? "En curso"
              : "Pendiente"}
        </span>
        {m.pair1_id && m.pair2_id && useWinnerPicker ? (
          <WinnerPickerButtons
            tournamentId={id}
            matchId={m.id}
            pair1Name={pairNameMap.get(m.pair1_id) ?? "Pareja 1"}
            pair2Name={pairNameMap.get(m.pair2_id) ?? "Pareja 2"}
          />
        ) : m.pair1_id && m.pair2_id ? (
          <form
            action={saveTournamentMatchFormAction}
            className="mt-2 grid gap-2 sm:grid-cols-4"
          >
            <input type="hidden" name="tournament_id" value={id} />
            <input type="hidden" name="match_id" value={m.id} />
            <input type="hidden" name="sets_json" value="[]" />
            <input
              type="number"
              name="pair1_score"
              min={0}
              max={3}
              required
              defaultValue={m.pair1_score ?? ""}
              placeholder="Sets P1"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-[var(--text-primary)]"
            />
            <input
              type="number"
              name="pair2_score"
              min={0}
              max={3}
              required
              defaultValue={m.pair2_score ?? ""}
              placeholder="Sets P2"
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-[var(--text-primary)]"
            />
            <button
              type="submit"
              className={`${adminCTAPrimary} px-2 py-1 text-xs`}
            >
              {m.status === "finished" ? "Editar" : "Guardar"}
            </button>
          </form>
        ) : null}
      </li>
    );
  }

  function bracketSection(title: string, bracketMatches: MatchRow[]) {
    return (
      <section>
        <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        {courtList.length > 0 ? (
          <TournamentScheduler
            tournamentId={id}
            clubId={tour.club_id}
            courts={courtList}
            matches={bracketMatches.map((m) => ({
              id: m.id,
              round_name: m.round_name,
              pair1_name: m.pair1_id
                ? (pairNameMap.get(m.pair1_id) ?? "—")
                : "—",
              pair2_name: m.pair2_id
                ? (pairNameMap.get(m.pair2_id) ?? "—")
                : "—",
              court_id: m.court_id,
              scheduled_date: m.scheduled_date,
              scheduled_time: m.scheduled_time,
              notes: m.notes,
            }))}
          />
        ) : null}
        <ul className="mt-3 space-y-3">
          {bracketMatches.map((m) => matchCard(m))}
        </ul>
      </section>
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.padelibre.online";
  const courtHours = Math.round((matchRows.length * 90) / 60);
  const penaPairs = regList
    .filter((r) => r.player2_id)
    .map((r) => ({ id: r.id, label: pairNameMap.get(r.id) ?? "Pareja" }));

  const statusBadgeClass =
    tour.status === "open"
      ? adminBadgeLima
      : tour.status === "in_progress"
        ? adminBadgePending
        : tour.status === "cancelled"
          ? adminBadgeError
          : adminBadgeNeutral;

  function bindCancelRegistration(registrationId: string) {
    const fd = new FormData();
    fd.set("registration_id", registrationId);
    fd.set("tournament_id", id);
    return cancelRegistrationAction.bind(null, fd);
  }
  const cancelTournamentBound = (() => {
    const fd = new FormData();
    fd.set("tournament_id", id);
    return cancelTournamentFormAction.bind(null, fd);
  })();

  function nextPowerOf2(n: number): number {
    let p = 1;
    while (p < n) p *= 2;
    return p;
  }
  const paidCount = approved.length;
  const isPowerOf2 = paidCount > 0 && (paidCount & (paidCount - 1)) === 0;
  const showPowerOf2Warning =
    tour.status === "open" &&
    tour.tournament_type === "eliminacion" &&
    paidCount > 0 &&
    !isPowerOf2;

  // Campeón americano: gana la Final si existe y ya se jugó; si no, 1er lugar del round-robin.
  const americanoFinalMatch =
    americanoFinalMatches.find((m) => m.round === FINAL_ROUND) ?? null;
  const americanoRanking = buildAmericanoRanking(
    americanoRegularMatches as MatchForRanking[],
  );
  const americanoChampionName =
    americanoFinalMatch?.status === "finished" &&
    americanoFinalMatch.winner_pair_id
      ? (pairNameMap.get(americanoFinalMatch.winner_pair_id) ?? null)
      : americanoRanking[0]
        ? (pairNameMap.get(americanoRanking[0].pairId) ?? null)
        : null;

  // Campeón eliminación: ganador de la Final = partido de mayor `round` en la llave de oro.
  const eliminacionFinalMatch = goldMatches.length
    ? goldMatches.reduce(
        (max, m) => (m.round > max.round ? m : max),
        goldMatches[0],
      )
    : null;
  const eliminacionChampionName =
    eliminacionFinalMatch?.status === "finished" &&
    eliminacionFinalMatch.winner_pair_id
      ? (pairNameMap.get(eliminacionFinalMatch.winner_pair_id) ?? null)
      : null;

  const editableTournament: EditableTournament = {
    id,
    tournamentType: tour.tournament_type,
    name: tour.name,
    startDate: tour.start_date,
    endDate: tour.end_date,
    startTime: String(tour.start_time).slice(0, 5),
    registrationDeadline: tour.registration_deadline,
    maxPairs: tour.max_pairs,
    pricePerPair: Number(tour.price_per_pair),
    allowedCategories: tour.allowed_categories ?? [],
    hasFinals: tour.has_finals ?? true,
    matchFormat: (tour.match_format === "tiempo" ? "tiempo" : "set") as
      "set" | "tiempo",
    matchDurationMinutes: tour.match_duration_minutes,
    consolationBracket: tour.consolation_bracket,
    multiDay: tour.multi_day ?? false,
    numCourts: tour.num_courts,
    foodIncluded: tour.food_included,
    whatIncludes: tour.what_includes ?? [],
    contactPhone: tour.contact_phone,
    prizes: tour.prizes,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pb-28 pt-6 md:pb-10">
      <TournamentRealtimeRefresh tournamentId={id} />
      <Link
        href="/admin/torneos"
        className="inline-flex items-center gap-1 text-sm font-medium text-[#0461C4] dark:text-sky-400"
      >
        <ChevronLeft size={18} />
        Torneos
      </Link>

      <header
        className={`${adminCard} ${tour.status === "in_progress" ? adminAccentBar : ""}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={adminKicker}>{typeBadge}</p>
          <span className={statusBadgeClass}>
            {TOURNAMENT_STATUS_LABELS[tour.status] ?? tour.status}
          </span>
        </div>
        <h1 className={`mt-1 ${adminTitle}`}>{tour.name}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {format(parseISO(tour.start_date), "d 'de' MMMM yyyy", {
            locale: es,
          })}
        </p>
        {tour.description ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {tour.description}
          </p>
        ) : null}
        {tour.is_individual ? (
          <div className="mt-2 text-xs text-[var(--text-tertiary)]">
            {tour.game_format ? <p>Formato: {tour.game_format}</p> : null}
          </div>
        ) : null}
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          Categoría:{" "}
          {tour.allowed_categories && tour.allowed_categories.length > 0
            ? tour.allowed_categories.join(" · ")
            : "Todas las categorías"}
        </p>
        <div className="mt-2">
          <p className="text-sm font-semibold text-[var(--text-secondary)]">
            Precio: $
            {Math.round(Number(tour.price_per_pair)).toLocaleString("es-AR")}{" "}
            por {tour.is_individual ? "jugador" : "pareja"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            {tour.requires_deposit
              ? `Con seña: $${calculateDepositAmount(Number(tour.price_per_pair), tour.deposit_type ?? "fixed", Number(tour.deposit_value)).toLocaleString("es-AR")} al inscribirse, saldo en el club.`
              : "Sin seña: se cobra el precio completo al inscribirse."}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={adminCard}>
          <p className={adminKicker}>
            {tour.is_individual ? "Jugadores" : "Inscriptos"}
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
            {approved.length}/{tour.max_pairs}
          </p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Lista de espera</p>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
            {waitlist.length}
          </p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>
            {tour.is_individual ? "Precio/jugador" : "Precio/pareja"}
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
            ${Math.round(Number(tour.price_per_pair)).toLocaleString("es-AR")}
          </p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Estado</p>
          <p className="mt-2">
            <span className={statusBadgeClass}>
              {TOURNAMENT_STATUS_LABELS[tour.status] ?? tour.status}
            </span>
          </p>
        </div>
      </section>

      <TournamentConfigSection
        tournament={editableTournament}
        typeLabel={typeBadge}
        startDateLabel={`${format(parseISO(tour.start_date), "d MMM yyyy", { locale: es })} · ${String(tour.start_time).slice(0, 5)} hs`}
        endDateLabel={format(parseISO(tour.end_date), "d MMM yyyy", {
          locale: es,
        })}
        deadlineLabel={format(
          parseISO(tour.registration_deadline),
          "d MMM yyyy · HH:mm",
          { locale: es },
        )}
        editable={tour.status === "open"}
      />

      {showPowerOf2Warning ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
          ⚠️ Tenés {paidCount} pareja{paidCount !== 1 ? "s" : ""} pagas. Para
          eliminación directa necesitás una potencia de 2 (8, 16, 32...).
          Próxima válida: {nextPowerOf2(paidCount)}.
        </div>
      ) : null}

      <section className="flex flex-wrap gap-2">
        {tour.status === "open" ? (
          <form action={startTournamentFormAction}>
            <input type="hidden" name="tournament_id" value={id} />
            <button type="submit" className={adminCTAPrimary}>
              Iniciar torneo
            </button>
          </form>
        ) : null}
        {tour.status === "in_progress" ? (
          <form action={finishTournamentFormAction}>
            <input type="hidden" name="tournament_id" value={id} />
            <button type="submit" className={adminCTAPrimary}>
              Finalizar torneo
            </button>
          </form>
        ) : null}
        {tour.status !== "finished" && tour.status !== "cancelled" ? (
          <ConfirmActionButton
            action={cancelTournamentBound}
            confirmText="¿Seguro que querés cancelar el torneo? Esta acción no se puede deshacer."
            label="Cancelar torneo"
            className={adminCTADangerCompact}
          />
        ) : null}
        <CopyLinkButton
          url={`${siteUrl}/torneos/${id}`}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]"
        />
        <a
          href={`https://wa.me/?text=${encodeURIComponent(
            buildAdminWhatsAppMessage(
              {
                id,
                name: tour.name,
                tournament_type: tour.tournament_type,
                start_date: tour.start_date,
                start_time: tour.start_time,
                price_per_pair: tour.price_per_pair,
                max_pairs: tour.max_pairs,
                allowed_categories: tour.allowed_categories,
                guaranteed_matches: tour.guaranteed_matches,
                prizes: tour.prizes,
                match_format: tour.match_format,
                match_duration_minutes: tour.match_duration_minutes,
                club_name: clubName,
              },
              siteUrl,
            ),
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/[0.06] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[#25D366]/10"
        >
          💬 Compartir por WhatsApp
        </a>
      </section>

      <section>
        <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">
          Inscriptos
        </h2>
        {tour.status === "open" ? (
          <ReorderRegistrations
            tournamentId={id}
            items={approved.map((r) => ({
              id: r.id,
              label: pairNameMap.get(r.id) ?? "Jugador",
            }))}
          />
        ) : null}
        <ul className="mt-2 space-y-2">
          {approved.map((r) => (
            <li
              key={r.id}
              className={`${adminCard} flex flex-wrap items-center justify-between gap-2 text-sm`}
            >
              <span className="flex items-center gap-2">
                {r.registration_order != null ? (
                  <span className="font-mono text-xs text-[var(--text-tertiary)]">
                    #{r.registration_order}
                  </span>
                ) : null}
                {profileMap.get(r.player1_id)?.name ?? "Jugador"}
                {r.player2_id
                  ? ` + ${profileMap.get(r.player2_id)?.name ?? ""}`
                  : " (individual)"}
              </span>
              <div className="flex items-center gap-2">
                <FinancialStatusPill
                  financialStatus={r.financial_status}
                  amountPaid={r.amount_paid}
                  amountPending={r.amount_pending}
                />
                {tour.status === "open" ? (
                  <ConfirmActionButton
                    action={bindCancelRegistration(r.id)}
                    confirmText="¿Seguro que querés bajar esta pareja del torneo?"
                    label="Bajar pareja"
                    className={adminCTADangerCompact}
                  />
                ) : null}
              </div>
            </li>
          ))}
          {pending.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/20"
            >
              <span className="flex items-center gap-2">
                {r.registration_order != null ? (
                  <span className="font-mono text-xs text-[var(--text-tertiary)]">
                    #{r.registration_order}
                  </span>
                ) : null}
                {profileMap.get(r.player1_id)?.name ?? "Jugador"}
                {r.player2_id
                  ? ` + ${profileMap.get(r.player2_id)?.name ?? ""}`
                  : ""}
              </span>
              <div className="flex items-center gap-2">
                <FinancialStatusPill
                  financialStatus={r.financial_status}
                  amountPaid={r.amount_paid}
                  amountPending={r.amount_pending}
                />
                {tour.status === "open" ? (
                  <ConfirmActionButton
                    action={bindCancelRegistration(r.id)}
                    confirmText="¿Seguro que querés bajar esta pareja del torneo?"
                    label="Bajar pareja"
                    className={adminCTADangerCompact}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {waitlist.length > 0 ? (
        <section>
          <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">
            Lista de espera
          </h2>
          <ul className="mt-2 space-y-2 text-sm text-[var(--text-secondary)]">
            {waitlist.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  {profileMap.get(r.player1_id)?.name}
                  {r.player2_id
                    ? ` + ${profileMap.get(r.player2_id)?.name}`
                    : ""}
                </span>
                {tour.status === "open" ? (
                  <ConfirmActionButton
                    action={bindCancelRegistration(r.id)}
                    confirmText="¿Seguro que querés bajar esta pareja del torneo?"
                    label="Bajar pareja"
                    className={adminCTADangerCompact}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tour.status === "finished" ? (
        <div
          className={`${adminCard} border-[#CCFF00]/30 bg-[#CCFF00]/[0.04] text-center`}
        >
          <p className="mb-2 text-3xl">🏆</p>
          {tour.tournament_type === "pena" ? (
            <>
              <p className={adminKicker}>Peña finalizada</p>
              <p className="mt-1 text-lg font-black text-[var(--text-primary)]">
                🎉 ¡Peña finalizada! Gracias a todos los participantes.
              </p>
            </>
          ) : (
            <>
              <p className={adminKicker}>Campeón del torneo</p>
              <p className="mt-1 text-xl font-black text-[var(--text-primary)]">
                {(tour.tournament_type === "americano"
                  ? americanoChampionName
                  : eliminacionChampionName) ?? "Por determinar"}
              </p>
            </>
          )}
        </div>
      ) : null}

      {tour.tournament_type === "americano" &&
        (tour.status === "in_progress" || tour.status === "finished") && (
          <AmericanoLeaderboard
            matches={americanoRegularMatches}
            pairNames={Object.fromEntries(pairNameMap)}
          />
        )}

      {(tour.status === "in_progress" || tour.status === "finished") &&
      tour.tournament_type === "eliminacion" ? (
        <>
          {bracketSection("🥇 Llave de Oro", goldMatches)}
          {tour.consolation_bracket
            ? bracketSection("🥈 Llave de Plata", silverMatches)
            : null}
        </>
      ) : tour.tournament_type === "pena" ? (
        <section>
          <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">
            Primera ronda
          </h2>
          {matchRows.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-tertiary)]">
              {tour.status === "open"
                ? "Se genera automáticamente al iniciar la peña."
                : "Todavía no se generó la ronda."}
            </p>
          ) : (
            <>
              {courtList.length > 0 ? (
                <TournamentScheduler
                  tournamentId={id}
                  clubId={tour.club_id}
                  courts={courtList}
                  matches={matchRows.map((m) => ({
                    id: m.id,
                    round_name: m.round_name,
                    pair1_name: m.pair1_id
                      ? (pairNameMap.get(m.pair1_id) ?? "—")
                      : "—",
                    pair2_name: m.pair2_id
                      ? (pairNameMap.get(m.pair2_id) ?? "—")
                      : "—",
                    court_id: m.court_id,
                    scheduled_date: m.scheduled_date,
                    scheduled_time: m.scheduled_time,
                    notes: m.notes,
                  }))}
                />
              ) : null}
              <ul className="mt-3 space-y-3">
                {matchRows.map((m) => {
                  async function handlePairSwap(formData: FormData) {
                    "use server";
                    const p1 =
                      String(formData.get("pair1_id") ?? "").trim() || null;
                    const p2 =
                      String(formData.get("pair2_id") ?? "").trim() || null;
                    await updatePenaMatchPairsAction(id, m.id, p1, p2);
                  }
                  return (
                    <li key={m.id} className={`${adminCard} text-sm`}>
                      <p className="text-xs font-semibold text-[var(--text-tertiary)]">
                        Partido {m.round}
                      </p>
                      <p className="mt-1 text-[var(--text-secondary)]">
                        {m.pair1_id
                          ? (pairNameMap.get(m.pair1_id) ?? "Pareja 1")
                          : "—"}{" "}
                        vs{" "}
                        {m.pair2_id
                          ? (pairNameMap.get(m.pair2_id) ?? "Pareja 2")
                          : "—"}
                      </p>
                      <form
                        action={handlePairSwap}
                        className="mt-2 grid gap-2 sm:grid-cols-3"
                      >
                        <select
                          name="pair1_id"
                          defaultValue={m.pair1_id ?? ""}
                          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]"
                        >
                          <option value="">— Sin asignar —</option>
                          {penaPairs.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <select
                          name="pair2_id"
                          defaultValue={m.pair2_id ?? ""}
                          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]"
                        >
                          <option value="">— Sin asignar —</option>
                          {penaPairs.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className={`${adminCTAPrimary} px-2 py-1 text-xs`}
                        >
                          Editar
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      ) : (
        <>
          {tour.status === "in_progress" && courtList.length > 0 && (
            <TournamentScheduler
              tournamentId={id}
              clubId={tour.club_id}
              courts={courtList}
              matches={americanoRegularMatches.map((m) => ({
                id: m.id,
                round_name: m.round_name,
                pair1_name: m.pair1_id
                  ? (pairNameMap.get(m.pair1_id) ?? "—")
                  : "—",
                pair2_name: m.pair2_id
                  ? (pairNameMap.get(m.pair2_id) ?? "—")
                  : "—",
                court_id: m.court_id,
                scheduled_date: m.scheduled_date,
                scheduled_time: m.scheduled_time,
                notes: m.notes,
              }))}
            />
          )}

          <section>
            <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">
              Fixture
            </h2>
            <p className="text-xs text-[var(--text-tertiary)]">
              ~{courtHours} h de cancha estimadas ·{" "}
              {americanoRegularMatches.length} partidos
            </p>
            <ul className="mt-3 space-y-3">
              {americanoRegularMatches.map((m) => matchCard(m))}
            </ul>
          </section>

          {americanoFinalMatches.length > 0 ? (
            <section>
              <h3 className="font-bold text-[var(--text-primary)]">
                🏆 Finales
              </h3>
              <ul className="mt-3 space-y-3">
                {americanoFinalMatches.map((m) => matchCard(m))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
