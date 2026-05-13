import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { MessageCircle } from "lucide-react";
import MotionPage from "@/components/motion-page";
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
      "id, name, description, tournament_type, status, max_pairs, price_per_pair, prize, start_date, end_date, start_time, registration_deadline, cancellation_hours, category_min, category_max, group_chat_id, clubs(name, logo_url)"
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
    prize: string | null;
    start_date: string;
    end_date: string;
    start_time: string;
    registration_deadline: string;
    cancellation_hours: number;
    category_min: number | null;
    category_max: number | null;
    group_chat_id: string | null;
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

  const { data: matches } = await supabase
    .from(DB_TABLES.tournamentMatches)
    .select("id, round, round_name, pair1_score, pair2_score, status, winner_pair_id, pair1_id, pair2_id")
    .eq("tournament_id", id)
    .order("round", { ascending: true });

  const approved = regList.filter((r) => r.payment_status === "approved" && !r.waitlist).length;
  const open = tour.status === "open" && new Date(tour.registration_deadline).getTime() > Date.now();
  const canRegister = open && levelOk && approved < tour.max_pairs;
  const already = regList.some((r) => r.player1_id === user.id && r.payment_status === "approved");

  const badge = TOURNAMENT_TYPE_OPTIONS.find((o) => o.value === tour.tournament_type)?.badge ?? tour.tournament_type;
  const dt = parseISO(`${tour.start_date}T${String(tour.start_time).slice(0, 5)}:00`);
  const dateLabel = format(dt, "EEEE d 'de' MMMM", { locale: es });
  const timeLabel = format(dt, "HH:mm");

  return (
    <MotionPage className="mx-auto min-h-screen w-full min-w-0 max-w-md overflow-x-hidden bg-[var(--bg-app)] px-4 pb-28 pt-6">
      <Link href="/torneos" className="text-sm font-medium text-[#0461C4]">
        ← Torneos
      </Link>

      <header className="mt-4 min-w-0 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{tour.clubs?.name ?? "Club"}</p>
        <h1 className="mt-1 break-words text-2xl font-bold leading-tight text-[var(--text-primary)]">{tour.name}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{badge}</p>
        <p className="mt-2 text-sm capitalize text-[var(--text-secondary)]">
          {dateLabel} · {timeLabel}hs
        </p>
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          {TOURNAMENT_STATUS_LABELS[tour.status] ?? tour.status} · {approved}/{tour.max_pairs} parejas ·{" "}
          {formatCategoryRange(tour.category_min, tour.category_max)}
        </p>
        <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">${Math.round(Number(tour.price_per_pair))} por pareja</p>
        {tour.prize ? <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">🏅 Premio: {tour.prize}</p> : null}
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
            <TournamentRegisterForm tournamentId={id} isMixing={tour.tournament_type === "mixing"} canRegister={canRegister} />
          )}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Parejas inscriptas</h2>
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
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Fixture</h2>
        <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
          {((matches ?? []) as Array<{
            id: string;
            round: number;
            round_name: string | null;
            pair1_score: number | null;
            pair2_score: number | null;
            status: string;
          }>).map((m) => (
            <li key={m.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2">
              <span className="text-xs text-[var(--text-tertiary)]">
                R{m.round} · {m.round_name ?? "—"}
              </span>
              <p className="font-medium text-[var(--text-primary)]">
                {m.pair1_score ?? "—"} — {m.pair2_score ?? "—"} ({m.status})
              </p>
            </li>
          ))}
        </ul>
      </section>

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
