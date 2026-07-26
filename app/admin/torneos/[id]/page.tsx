import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { FinancialStatusPill } from "@/components/admin/admin-status-pills";
import {
  adminAccentBar,
  adminBadgeLima,
  adminBadgeNeutral,
  adminBadgePending,
  adminCard,
  adminCTAPrimary,
  adminKicker,
  adminTitle,
} from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { calculateDepositAmount } from "@/lib/deposit-utils";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import { TOURNAMENT_STATUS_LABELS, TOURNAMENT_TYPE_OPTIONS } from "@/lib/tournament-constants";
import { TournamentRealtimeRefresh } from "@/components/tournament-realtime-refresh";
import { formatCategoryRange } from "@/lib/tournament-utils";
import { finishTournamentFormAction, saveTournamentMatchFormAction, startTournamentFormAction, updatePenaMatchPairsAction } from "./actions";
import { AmericanoLeaderboard } from "./AmericanoLeaderboard";
import { TournamentScheduler } from "./TournamentScheduler";

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function AdminTorneoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: t } = await supabase
    .from(DB_TABLES.tournaments)
    .select(
      "id, club_id, name, description, tournament_type, status, max_pairs, price_per_pair, requires_deposit, deposit_type, deposit_value, prize, start_date, end_date, start_time, registration_deadline, cancellation_hours, category_min, category_max, group_chat_id, consolation_bracket, what_includes, game_format, is_individual"
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
  };
  if (!ctx.clubIds.includes(tour.club_id)) redirect("/admin/torneos");

  const service = createServiceClient();
  const [{ data: regs }, { data: matches }, { data: courts }] = await Promise.all([
    service
      .from(DB_TABLES.tournamentRegistrations)
      .select(
        "id, player1_id, player2_id, payment_status, waitlist, registered_at, financial_status, amount_paid, amount_pending"
      )
      .eq("tournament_id", id)
      .order("registered_at", { ascending: true }),
    service
      .from(DB_TABLES.tournamentMatches)
      .select("id, round, round_name, bracket, pair1_id, pair2_id, pair1_score, pair2_score, status, winner_pair_id, court_id, scheduled_date, scheduled_time, notes")
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
    financial_status: string | null;
    amount_paid: number | null;
    amount_pending: number | null;
  }>;
  const playerIds = [...new Set(regList.flatMap((r) => [r.player1_id, r.player2_id].filter(Boolean) as string[]))];
  const { data: profiles } = playerIds.length
    ? await service.from(DB_TABLES.profiles).select("user_id, name, avatar_url").in("user_id", playerIds)
    : { data: [] };
  const profileMap = new Map(
    ((profiles ?? []) as Array<{ user_id: string; name: string | null; avatar_url: string | null }>).map((p) => [
      p.user_id,
      p,
    ])
  );

  const pairNameMap = new Map<string, string>();
  for (const r of regList) {
    const p1 = profileMap.get(r.player1_id)?.name ?? "Jugador";
    const p2 = r.player2_id ? profileMap.get(r.player2_id)?.name ?? "Jugador" : null;
    pairNameMap.set(r.id, p2 ? `${p1} / ${p2}` : p1);
  }

  const typeBadge = TOURNAMENT_TYPE_OPTIONS.find((o) => o.value === tour.tournament_type)?.badge ?? tour.tournament_type;
  const approved = regList.filter((r) => r.payment_status === "approved" && !r.waitlist);
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
    court_id: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    notes: string | null;
  }>;
  type MatchRow = (typeof matchRows)[number];
  const goldMatches = matchRows.filter((m) => (m.bracket ?? "gold") === "gold");
  const silverMatches = matchRows.filter((m) => m.bracket === "silver");

  function matchCard(m: MatchRow) {
    return (
      <li key={m.id} className={`${adminCard} text-sm`}>
        <p className="text-xs font-semibold text-[var(--text-tertiary)]">
          Ronda {m.round} · {m.round_name ?? "—"}
        </p>
        <p className="mt-1 text-[var(--text-secondary)]">
          {m.pair1_id ? pairNameMap.get(m.pair1_id) ?? "Pareja 1" : "—"} vs{" "}
          {m.pair2_id ? pairNameMap.get(m.pair2_id) ?? "Pareja 2" : "—"}
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
        {m.pair1_id && m.pair2_id ? (
          <form action={saveTournamentMatchFormAction} className="mt-2 grid gap-2 sm:grid-cols-4">
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
            <button type="submit" className={`${adminCTAPrimary} px-2 py-1 text-xs`}>
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
        <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
        {courtList.length > 0 ? (
          <TournamentScheduler
            tournamentId={id}
            courts={courtList}
            matches={bracketMatches.map((m) => ({
              id: m.id,
              round_name: m.round_name,
              pair1_name: m.pair1_id ? pairNameMap.get(m.pair1_id) ?? "—" : "—",
              pair2_name: m.pair2_id ? pairNameMap.get(m.pair2_id) ?? "—" : "—",
              court_id: m.court_id,
              scheduled_date: m.scheduled_date,
              scheduled_time: m.scheduled_time,
              notes: m.notes,
            }))}
          />
        ) : null}
        <ul className="mt-3 space-y-3">{bracketMatches.map((m) => matchCard(m))}</ul>
      </section>
    );
  }

  const courtHours = Math.round((matchRows.length * 90) / 60);
  const penaPairs = regList
    .filter((r) => r.player2_id)
    .map((r) => ({ id: r.id, label: pairNameMap.get(r.id) ?? "Pareja" }));

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pb-28 pt-6 md:pb-10">
      <TournamentRealtimeRefresh tournamentId={id} />
      <Link href="/admin/torneos" className="inline-flex items-center gap-1 text-sm font-medium text-[#0461C4] dark:text-sky-400">
        <ChevronLeft size={18} />
        Torneos
      </Link>

      <header className={`${adminCard} ${tour.status === "in_progress" ? adminAccentBar : ""}`}>
        <p className={adminKicker}>{typeBadge}</p>
        <h1 className={`mt-1 ${adminTitle}`}>{tour.name}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {TOURNAMENT_STATUS_LABELS[tour.status] ?? tour.status} · {approved.length}/{tour.max_pairs}{" "}
          {tour.is_individual ? "jugadores pagados" : "parejas pagadas"}
        </p>
        {tour.description ? <p className="mt-2 text-sm text-[var(--text-secondary)]">{tour.description}</p> : null}
        {tour.is_individual ? (
          <div className="mt-2 text-xs text-[var(--text-tertiary)]">
            {tour.game_format ? <p>Formato: {tour.game_format}</p> : null}
            {tour.what_includes && tour.what_includes.length > 0 ? <p>Incluye: {tour.what_includes.join(", ")}</p> : null}
          </div>
        ) : null}
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          Categoría: {formatCategoryRange(tour.category_min, tour.category_max)}
        </p>
        <div className="mt-2">
          <p className="text-sm font-semibold text-[var(--text-secondary)]">
            Precio: ${Math.round(Number(tour.price_per_pair)).toLocaleString("es-AR")} por {tour.is_individual ? "jugador" : "pareja"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            {tour.requires_deposit
              ? `Con seña: $${calculateDepositAmount(Number(tour.price_per_pair), tour.deposit_type ?? "fixed", Number(tour.deposit_value)).toLocaleString("es-AR")} al inscribirse, saldo en el club.`
              : "Sin seña: se cobra el precio completo al inscribirse."}
          </p>
        </div>
      </header>

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
      </section>

      <section>
        <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">Inscriptos</h2>
        <ul className="mt-2 space-y-2">
          {approved.map((r) => (
            <li
              key={r.id}
              className={`${adminCard} flex flex-wrap items-center justify-between gap-2 text-sm`}
            >
              <span>
                {profileMap.get(r.player1_id)?.name ?? "Jugador"}
                {r.player2_id ? ` + ${profileMap.get(r.player2_id)?.name ?? ""}` : " (individual)"}
              </span>
              <FinancialStatusPill
                financialStatus={r.financial_status}
                amountPaid={r.amount_paid}
                amountPending={r.amount_pending}
              />
            </li>
          ))}
          {pending.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
              <span>
                {profileMap.get(r.player1_id)?.name ?? "Jugador"}
                {r.player2_id ? ` + ${profileMap.get(r.player2_id)?.name ?? ""}` : ""}
              </span>
              <FinancialStatusPill
                financialStatus={r.financial_status}
                amountPaid={r.amount_paid}
                amountPending={r.amount_pending}
              />
            </li>
          ))}
        </ul>
      </section>

      {waitlist.length > 0 ? (
        <section>
          <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">Lista de espera</h2>
          <ul className="mt-2 text-sm text-[var(--text-secondary)]">
            {waitlist.map((r) => (
              <li key={r.id}>
                {profileMap.get(r.player1_id)?.name}
                {r.player2_id ? ` + ${profileMap.get(r.player2_id)?.name}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tour.tournament_type === "americano" && tour.status === "in_progress" && (
        <AmericanoLeaderboard
          matches={matchRows}
          pairNames={Object.fromEntries(pairNameMap)}
        />
      )}

      {tour.status === "in_progress" && tour.tournament_type === "eliminacion" ? (
        <>
          {bracketSection("🥇 Llave de Oro", goldMatches)}
          {tour.consolation_bracket ? bracketSection("🥈 Llave de Plata", silverMatches) : null}
        </>
      ) : tour.tournament_type === "pena" ? (
        <section>
          <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">Primera ronda</h2>
          {matchRows.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-tertiary)]">
              {tour.status === "open" ? "Se genera automáticamente al iniciar la peña." : "Todavía no se generó la ronda."}
            </p>
          ) : (
            <>
              {courtList.length > 0 ? (
                <TournamentScheduler
                  tournamentId={id}
                  courts={courtList}
                  matches={matchRows.map((m) => ({
                    id: m.id,
                    round_name: m.round_name,
                    pair1_name: m.pair1_id ? pairNameMap.get(m.pair1_id) ?? "—" : "—",
                    pair2_name: m.pair2_id ? pairNameMap.get(m.pair2_id) ?? "—" : "—",
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
                    const p1 = String(formData.get("pair1_id") ?? "").trim() || null;
                    const p2 = String(formData.get("pair2_id") ?? "").trim() || null;
                    await updatePenaMatchPairsAction(id, m.id, p1, p2);
                  }
                  return (
                    <li key={m.id} className={`${adminCard} text-sm`}>
                      <p className="text-xs font-semibold text-[var(--text-tertiary)]">Partido {m.round}</p>
                      <p className="mt-1 text-[var(--text-secondary)]">
                        {m.pair1_id ? pairNameMap.get(m.pair1_id) ?? "Pareja 1" : "—"} vs{" "}
                        {m.pair2_id ? pairNameMap.get(m.pair2_id) ?? "Pareja 2" : "—"}
                      </p>
                      <form action={handlePairSwap} className="mt-2 grid gap-2 sm:grid-cols-3">
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
                        <button type="submit" className={`${adminCTAPrimary} px-2 py-1 text-xs`}>
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
              courts={courtList}
              matches={matchRows.map((m) => ({
                id: m.id,
                round_name: m.round_name,
                pair1_name: m.pair1_id ? pairNameMap.get(m.pair1_id) ?? "—" : "—",
                pair2_name: m.pair2_id ? pairNameMap.get(m.pair2_id) ?? "—" : "—",
                court_id: m.court_id,
                scheduled_date: m.scheduled_date,
                scheduled_time: m.scheduled_time,
                notes: m.notes,
              }))}
            />
          )}

          <section>
            <h2 className="font-admin-display text-lg font-semibold text-[var(--text-primary)]">Fixture</h2>
            <p className="text-xs text-[var(--text-tertiary)]">~{courtHours} h de cancha estimadas · {matchRows.length} partidos</p>
            <ul className="mt-3 space-y-3">{matchRows.map((m) => matchCard(m))}</ul>
          </section>
        </>
      )}
    </div>
  );
}
