import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { FinancialStatusPill } from "@/components/admin/admin-status-pills";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { calculateDepositAmount } from "@/lib/deposit-utils";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import { TOURNAMENT_STATUS_LABELS, TOURNAMENT_TYPE_OPTIONS } from "@/lib/tournament-constants";
import { TournamentRealtimeRefresh } from "@/components/tournament-realtime-refresh";
import { formatCategoryRange } from "@/lib/tournament-utils";
import { advanceMixingRoundFormAction, finishTournamentFormAction, saveTournamentMatchFormAction, startTournamentFormAction } from "./actions";
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
      "id, club_id, name, description, tournament_type, status, max_pairs, price_per_pair, requires_deposit, deposit_type, deposit_value, prize, start_date, end_date, start_time, registration_deadline, cancellation_hours, category_min, category_max, group_chat_id"
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
      .select("id, round, round_name, pair1_id, pair2_id, pair1_score, pair2_score, status, winner_pair_id, court_id, scheduled_date, scheduled_time, notes")
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

  const courtHours = Math.round((matchRows.length * 90) / 60);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pb-28 pt-6 md:pb-10">
      <TournamentRealtimeRefresh tournamentId={id} />
      <Link href="/admin/torneos" className="inline-flex items-center gap-1 text-sm font-medium text-[#0461C4] dark:text-sky-400">
        <ChevronLeft size={18} />
        Torneos
      </Link>

      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{typeBadge}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{tour.name}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {TOURNAMENT_STATUS_LABELS[tour.status] ?? tour.status} · {approved.length}/{tour.max_pairs} parejas pagadas
        </p>
        {tour.description ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{tour.description}</p> : null}
        <p className="mt-2 text-xs text-slate-500">
          Categoría: {formatCategoryRange(tour.category_min, tour.category_max)}
        </p>
        <div className="mt-2">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Precio: ${Math.round(Number(tour.price_per_pair)).toLocaleString("es-AR")} por pareja
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
            <button
              type="submit"
              className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Iniciar torneo
            </button>
          </form>
        ) : null}
        {tour.status === "in_progress" && tour.tournament_type === "mixing" ? (
          <form action={advanceMixingRoundFormAction}>
            <input type="hidden" name="tournament_id" value={id} />
            <button type="submit" className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500">
              Generar siguiente ronda
            </button>
          </form>
        ) : null}
        {tour.status === "in_progress" ? (
          <form action={finishTournamentFormAction}>
            <input type="hidden" name="tournament_id" value={id} />
            <button type="submit" className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-700">
              Finalizar torneo
            </button>
          </form>
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Inscriptos</h2>
        <ul className="mt-2 space-y-2">
          {approved.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Lista de espera</h2>
          <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {waitlist.map((r) => (
              <li key={r.id}>
                {profileMap.get(r.player1_id)?.name}
                {r.player2_id ? ` + ${profileMap.get(r.player2_id)?.name}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(tour.tournament_type === "americano" || tour.tournament_type === "grupos_eliminacion") &&
        tour.status === "in_progress" && (
          <AmericanoLeaderboard
            matches={matchRows}
            pairNames={Object.fromEntries(pairNameMap)}
          />
        )}

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
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Fixture</h2>
        <p className="text-xs text-slate-500">~{courtHours} h de cancha estimadas · {matchRows.length} partidos</p>
        <ul className="mt-3 space-y-3">
          {matchRows.map((m) => (
            <li key={m.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold text-slate-500">
                Ronda {m.round} · {m.round_name ?? "—"}
              </p>
              <p className="mt-1 text-slate-800 dark:text-slate-100">
                {m.pair1_id ? pairNameMap.get(m.pair1_id) ?? "Pareja 1" : "—"} vs{" "}
                {m.pair2_id ? pairNameMap.get(m.pair2_id) ?? "Pareja 2" : "—"}
              </p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  m.status === "finished"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : m.status === "in_progress"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
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
                    className="rounded-lg border px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <input
                    type="number"
                    name="pair2_score"
                    min={0}
                    max={3}
                    required
                    defaultValue={m.pair2_score ?? ""}
                    placeholder="Sets P2"
                    className="rounded-lg border px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <button type="submit" className="rounded-lg bg-[#0461C4] px-2 py-1 text-xs font-semibold text-white">
                    {m.status === "finished" ? "Editar" : "Guardar"}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
