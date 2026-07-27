import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { MessageCircle } from "lucide-react";
import MotionPage from "@/components/motion-page";
import { TournamentRealtimeRefresh } from "@/components/tournament-realtime-refresh";
import { calculateDepositAmount } from "@/lib/deposit-utils";
import { DB_TABLES } from "@/lib/db-tables";
import { TOURNAMENT_STATUS_LABELS, TOURNAMENT_TYPE_OPTIONS } from "@/lib/tournament-constants";
import { formatCategoryRange, playerLevelInTournamentBounds } from "@/lib/tournament-utils";
import { createClient } from "@/utils/supabase/server";
import TournamentRegisterForm from "../tournament-register-form";

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function TorneoDetallePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/torneos/${id}`);

  const { data: t } = await supabase
    .from(DB_TABLES.tournaments)
    .select(
      "id, name, description, tournament_type, status, max_pairs, price_per_pair, requires_deposit, deposit_type, deposit_value, prize, start_date, end_date, start_time, registration_deadline, cancellation_hours, category_min, category_max, group_chat_id, what_includes, game_format, is_individual, clubs(name, logo_url)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!t) redirect("/torneos");

  const raw = t as Record<string, unknown>;
  const clubPack = raw.clubs;
  const clubRow = Array.isArray(clubPack)
    ? (clubPack[0] as { name?: string | null; logo_url?: string | null } | undefined)
    : (clubPack as { name?: string | null; logo_url?: string | null } | null);

  type TourRow = {
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
    what_includes: string[] | null;
    game_format: string | null;
    is_individual: boolean;
    clubs: { name: string | null; logo_url: string | null } | null;
  };

  const tour: TourRow = {
    ...(t as unknown as Omit<TourRow, "clubs">),
    clubs: clubRow
      ? { name: clubRow.name ?? null, logo_url: clubRow.logo_url ?? null }
      : null,
  };

  const { data: me } = await supabase.from(DB_TABLES.profiles).select("level").eq("user_id", user.id).maybeSingle();
  const myLevel = (me as { level?: number | null } | null)?.level;
  const levelOk = playerLevelInTournamentBounds(myLevel, tour.category_min, tour.category_max);

  const { data: regs } = await supabase
    .from(DB_TABLES.tournamentRegistrations)
    .select("id, player1_id, player2_id, payment_status, waitlist")
    .eq("tournament_id", id)
    .order("registered_at", { ascending: true });

  const regList = (regs ?? []) as Array<{
    id: string;
    player1_id: string;
    player2_id: string | null;
    payment_status: string;
    waitlist: boolean;
  }>;
  const playerIds = [...new Set(regList.flatMap((r) => [r.player1_id, r.player2_id].filter(Boolean) as string[]))];
  const { data: profiles } = playerIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id, name, avatar_url").in("user_id", playerIds)
    : { data: [] };
  const pmap = new Map(
    ((profiles ?? []) as Array<{ user_id: string; name: string | null; avatar_url: string | null }>).map((p) => [
      p.user_id,
      p,
    ])
  );

  // Mapa de registration_id → "Jugador 1 & Jugador 2"
  const pairNameMap = new Map<string, string>();
  for (const r of regList) {
    const p1 = pmap.get(r.player1_id)?.name ?? "Jugador";
    const p2 = r.player2_id ? pmap.get(r.player2_id)?.name ?? "Jugador" : null;
    pairNameMap.set(r.id, p2 ? `${p1} & ${p2}` : p1);
  }

  const { data: matches } = await supabase
    .from(DB_TABLES.tournamentMatches)
    .select("id, round, round_name, bracket, pair1_score, pair2_score, status, winner_pair_id, pair1_id, pair2_id, scheduled_date, scheduled_time, court_id, courts(name)")
    .eq("tournament_id", id)
    .order("round", { ascending: true });

  const approved = regList.filter((r) => r.payment_status === "approved" && !r.waitlist).length;
  const open = tour.status === "open" && new Date(tour.registration_deadline).getTime() > Date.now();
  const canRegister = open && levelOk && approved < tour.max_pairs;
  const already = regList.some(
    (r) => (r.player1_id === user.id || r.player2_id === user.id) && r.payment_status === "approved"
  );
  const myRegId = regList.find((r) => r.player1_id === user.id || r.player2_id === user.id)?.id ?? null;

  const badge = TOURNAMENT_TYPE_OPTIONS.find((o) => o.value === tour.tournament_type)?.badge ?? tour.tournament_type;
  const dt = parseISO(`${tour.start_date}T${String(tour.start_time).slice(0, 5)}:00`);
  const dateLabel = format(dt, "EEEE d 'de' MMMM", { locale: es });
  const timeLabel = format(dt, "HH:mm");
  const priceDisplay = Math.round(Number(tour.price_per_pair));
  const depositAmount = tour.requires_deposit
    ? calculateDepositAmount(Number(tour.price_per_pair), tour.deposit_type ?? "fixed", Number(tour.deposit_value))
    : priceDisplay;
  const saldoAmount = priceDisplay - depositAmount;

  return (
    <MotionPage className="mx-auto min-h-screen w-full min-w-0 max-w-md overflow-x-hidden bg-[var(--bg-app)] px-4 pb-28 pt-6">
      <TournamentRealtimeRefresh tournamentId={id} />
      <Link href="/torneos" className="text-sm font-medium text-[#0461C4]">
        ← Torneos
      </Link>

      <header className="mt-4 min-w-0 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{tour.clubs?.name ?? "Club"}</p>
        <h1 className="mt-1 break-words text-xl font-semibold leading-tight text-[var(--text-primary)]">{tour.name}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{badge}</p>
        <p className="mt-2 text-sm capitalize text-[var(--text-secondary)]">
          {dateLabel} · {timeLabel}hs
        </p>
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          {TOURNAMENT_STATUS_LABELS[tour.status] ?? tour.status} · {approved}/{tour.max_pairs}{" "}
          {tour.is_individual ? "jugadores" : "parejas"} · {formatCategoryRange(tour.category_min, tour.category_max)}
        </p>
        {tour.is_individual ? (
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            {[tour.game_format, tour.what_includes && tour.what_includes.length > 0 ? `Incluye: ${tour.what_includes.join(", ")}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <div className="mt-2 space-y-1.5">
          <p className="text-sm font-bold text-[var(--text-primary)]">
            ${priceDisplay.toLocaleString("es-AR")} por {tour.is_individual ? "jugador" : "pareja"}
          </p>
          {tour.requires_deposit ? (
            <div className="rounded-xl bg-[#0085FC]/10 px-3 py-2 text-xs">
              <p className="flex items-center justify-between font-semibold text-[#0461C4] dark:text-sky-300">
                <span>Seña a pagar ahora</span>
                <span>${depositAmount.toLocaleString("es-AR")}</span>
              </p>
              <p className="mt-1 flex items-center justify-between text-[var(--text-secondary)]">
                <span>Saldo en el club (el día del torneo)</span>
                <span className="font-semibold">${saldoAmount.toLocaleString("es-AR")}</span>
              </p>
            </div>
          ) : null}
        </div>
        {tour.prize ? <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">🏅 Premio: {tour.prize}</p> : null}
        {tour.description ? (
          <p className="mt-3 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{tour.description}</p>
        ) : null}
      </header>

      <section className="mt-6 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Cancelaciones</h2>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Podés cancelar con al menos {tour.cancellation_hours} horas de anticipación según política del club (consultá en recepción).
        </p>
      </section>

      {already ? (
        <p className="mt-6 rounded-2xl bg-emerald-500/10 px-4 py-3 text-center text-sm font-medium text-emerald-800 dark:text-emerald-200">
          Ya estás inscripto en este torneo.
        </p>
      ) : (
        <div className="mt-6">
          {!levelOk ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              Tu nivel no entra en el rango de este torneo.
            </p>
          ) : (
            <TournamentRegisterForm tournamentId={id} isIndividual={tour.is_individual} canRegister={canRegister} />
          )}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Parejas inscriptas</h2>
        <ul className="mt-3 space-y-2">
          {regList
            .filter((r) => r.payment_status === "approved")
            .map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm">
                <span className="font-medium text-[var(--text-primary)]">
                  {pmap.get(r.player1_id)?.name ?? "Jugador"}
                  {r.player2_id ? ` & ${pmap.get(r.player2_id)?.name ?? ""}` : ""}
                </span>
              </li>
            ))}
          {regList.filter((r) => r.payment_status === "approved").length === 0 ? (
            <li className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-4 text-center text-xs text-[var(--text-tertiary)]">
              Todavía no hay inscriptos.
            </li>
          ) : null}
        </ul>
      </section>

      {(() => {
        const matchRows = (matches ?? []) as Array<{
          id: string;
          round: number;
          round_name: string | null;
          bracket: "gold" | "silver" | null;
          pair1_id: string | null;
          pair2_id: string | null;
          pair1_score: number | null;
          pair2_score: number | null;
          winner_pair_id: string | null;
          status: string;
          scheduled_date: string | null;
          scheduled_time: string | null;
          court_id: string | null;
          courts: { name: string }[] | { name: string } | null;
        }>;
        if (matchRows.length === 0) return null;

        if (tour.is_individual) {
          const myMatch = matchRows.find((m) => myRegId != null && (m.pair1_id === myRegId || m.pair2_id === myRegId));
          if (!myMatch) {
            return (
              <section className="mt-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 text-center text-sm text-[var(--text-tertiary)]">
                Ya se armó la primera ronda. Si no ves tu partido acá, consultá con el club.
              </section>
            );
          }
          const myReg = regList.find((r) => r.id === myRegId);
          const partnerUserId = myReg?.player1_id === user.id ? myReg?.player2_id : myReg?.player1_id;
          const partnerName = partnerUserId ? pmap.get(partnerUserId)?.name ?? null : null;
          const opponentRegId = myMatch.pair1_id === myRegId ? myMatch.pair2_id : myMatch.pair1_id;
          const rivalsName = opponentRegId ? pairNameMap.get(opponentRegId) ?? "Por definir" : "Por definir";
          const courtName = Array.isArray(myMatch.courts) ? myMatch.courts[0]?.name : myMatch.courts?.name;
          const scheduleLabel = [
            courtName ?? null,
            myMatch.scheduled_date ? format(parseISO(myMatch.scheduled_date), "d MMM", { locale: es }) : null,
            myMatch.scheduled_time ? myMatch.scheduled_time.slice(0, 5) + "hs" : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <section className="mt-8 rounded-3xl border border-[#0085FC] bg-[#0085FC]/5 p-5 dark:border-sky-500 dark:bg-sky-950/20">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">🎉 Tu partido</h2>
              {partnerName ? (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Jugás con <span className="font-semibold text-[var(--text-primary)]">{partnerName}</span>
                </p>
              ) : null}
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Vs. <span className="font-semibold text-[var(--text-primary)]">{rivalsName}</span>
              </p>
              {scheduleLabel ? <p className="mt-1 text-xs text-[var(--text-tertiary)]">{scheduleLabel}</p> : null}
            </section>
          );
        }

        function matchCard(m: (typeof matchRows)[number]) {
          const name1 = m.pair1_id ? (pairNameMap.get(m.pair1_id) ?? "Pareja 1") : "Por definir";
          const name2 = m.pair2_id ? (pairNameMap.get(m.pair2_id) ?? "Pareja 2") : "Por definir";
          const finished = m.status === "finished";
          const winner = m.winner_pair_id;
          const courtName = Array.isArray(m.courts) ? m.courts[0]?.name : m.courts?.name;
          const isMine = myRegId != null && (m.pair1_id === myRegId || m.pair2_id === myRegId);
          const scheduleLabel = [
            m.scheduled_date ? format(parseISO(m.scheduled_date), "d MMM", { locale: es }) : null,
            m.scheduled_time ? m.scheduled_time.slice(0, 5) + "hs" : null,
            courtName ?? null,
          ].filter(Boolean).join(" · ");
          return (
            <li
              key={m.id}
              className={`rounded-2xl border px-3 py-3 ${
                isMine
                  ? "border-[#0085FC] bg-[#0085FC]/5 dark:border-sky-500 dark:bg-sky-950/20"
                  : "border-[var(--border-subtle)] bg-[var(--bg-card)]"
              }`}
            >
              <span className="text-xs font-semibold text-[var(--text-tertiary)]">
                {m.round_name ?? `Ronda ${m.round}`}
                {isMine ? " · Tu partido" : ""}
              </span>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className={`flex-1 truncate text-sm font-medium ${winner === m.pair1_id ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--text-primary)]"}`}>
                  {name1}
                </span>
                <span className="shrink-0 text-base font-bold tabular-nums text-[var(--text-secondary)]">
                  {finished ? `${m.pair1_score ?? 0} – ${m.pair2_score ?? 0}` : "vs"}
                </span>
                <span className={`flex-1 truncate text-right text-sm font-medium ${winner === m.pair2_id ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--text-primary)]"}`}>
                  {name2}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                {!finished ? (
                  <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    Pendiente
                  </span>
                ) : (
                  <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Finalizado
                  </span>
                )}
                {scheduleLabel ? (
                  <span className="text-[10px] text-[var(--text-tertiary)]">{scheduleLabel}</span>
                ) : null}
              </div>
            </li>
          );
        }

        if (tour.tournament_type === "eliminacion") {
          const goldMatches = matchRows.filter((m) => (m.bracket ?? "gold") === "gold");
          const silverMatches = matchRows.filter((m) => m.bracket === "silver");
          const myMatch = myRegId != null ? matchRows.find((m) => m.pair1_id === myRegId || m.pair2_id === myRegId) : undefined;
          const myBracket = myMatch ? (myMatch.bracket ?? "gold") : null;
          return (
            <>
              {myBracket ? (
                <p className="mt-8 text-sm font-medium text-[var(--text-secondary)]">
                  Estás en la {myBracket === "silver" ? "🥈 Llave de Plata" : "🥇 Llave de Oro"}.
                </p>
              ) : null}
              <section className={myBracket ? "mt-3" : "mt-8"}>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">🥇 Llave de Oro</h2>
                <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                  {goldMatches.map((m) => matchCard(m))}
                </ul>
              </section>
              {silverMatches.length > 0 ? (
                <section className="mt-8">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">🥈 Llave de Plata</h2>
                  <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                    {silverMatches.map((m) => matchCard(m))}
                  </ul>
                </section>
              ) : null}
            </>
          );
        }

        return (
          <section className="mt-8">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Fixture</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
              {matchRows.map((m) => matchCard(m))}
            </ul>
          </section>
        );
      })()}

      {tour.group_chat_id ? (
        <Link
          href={`/comunidad/mensajes/grupo/${tour.group_chat_id}`}
          className="mt-8 flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-3 text-sm font-semibold text-[#0461C4]"
        >
          <MessageCircle size={18} />
          Chat del torneo
        </Link>
      ) : null}
    </MotionPage>
  );
}
