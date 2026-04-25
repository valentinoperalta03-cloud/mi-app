import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock, Users } from "lucide-react";
import MotionPage from "@/components/motion-page";
import { CompetitiveResultConfirmationCard } from "@/components/competitive-result-confirmation-card";
import { MatchResultForm } from "@/components/match-result-form";
import { Badge } from "@/components/ui/badge";
import {
  fetchMatchById,
  matchClubName,
  matchCourtName,
  matchCourtPrice,
  type UpcomingMatchRow,
} from "@/lib/matches";
import { DB_TABLES } from "@/lib/db-tables";
import type { MatchParticipantWithProfile } from "@/lib/database.types";
import { matchTypeAffectsTechnicalRating } from "@/lib/level-logic";
import { createClient } from "@/utils/supabase/server";

type PageProps = { params: Promise<{ id: string }> };

function unwrapProfile(mp: MatchParticipantWithProfile) {
  const prof = mp.profiles;
  return Array.isArray(prof) ? prof[0] : prof;
}

function profileName(mp: MatchParticipantWithProfile): string {
  return unwrapProfile(mp)?.name?.trim() || "Jugador";
}

export default async function MatchDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: raw, error } = await fetchMatchById(supabase, id);
  if (error || !raw) {
    redirect("/partidos");
  }

  const m = raw as unknown as UpcomingMatchRow;
  const when = format(parseISO(m.date), "EEEE d MMMM yyyy · HH:mm", { locale: es });
  const price = matchCourtPrice(m);
  const rawParts = (m.match_participants ?? []) as MatchParticipantWithProfile[];
  const players = [...rawParts].sort((a, b) => a.player_id.localeCompare(b.player_id));
  const n = players.length;

  const ownerId = m.owner_id ?? null;
  const allowed =
    ownerId === user.id || players.some((p) => p.player_id === user.id);

  const { data: resultRow } = await supabase
    .from(DB_TABLES.matchResults)
    .select("team_a_score, team_b_score, status, proposed_by")
    .eq("match_id", id)
    .maybeSingle();

  const rr = resultRow as {
    team_a_score: number | null;
    team_b_score: number | null;
    status?: string | null;
    proposed_by?: string | null;
  } | null;
  const hasFinalResult =
    rr != null &&
    rr.team_a_score != null &&
    rr.team_b_score != null &&
    Number.isFinite(Number(rr.team_a_score)) &&
    Number.isFinite(Number(rr.team_b_score)) &&
    rr.status === "confirmed";
  const hasPendingProposal =
    rr != null &&
    rr.team_a_score != null &&
    rr.team_b_score != null &&
    rr.status === "pending_confirmation";
  const isDisputed = rr?.status === "disputed";

  const { count: confirmCount } = await supabase
    .from(DB_TABLES.matchResultConfirmations)
    .select("id", { count: "exact", head: true })
    .eq("match_id", id);

  const { data: matchState } = await supabase
    .from(DB_TABLES.matches)
    .select("result_locked_by, result_locked_team, result_lock_expires_at, result_status")
    .eq("id", id)
    .maybeSingle();
  const ms = (matchState ?? null) as {
    result_locked_by?: string | null;
    result_locked_team?: string | null;
    result_lock_expires_at?: string | null;
    result_status?: string | null;
  } | null;

  const names = players.map(profileName);
  const teamALabel =
    n >= 2 ? `Equipo A (${names[0] ?? "—"} / ${names[1] ?? "—"})` : "Equipo A";
  const teamBLabel =
    n >= 4 ? `Equipo B (${names[2] ?? "—"} / ${names[3] ?? "—"})` : "Equipo B";

  const teamAIds = players.slice(0, 2).map((p) => p.player_id);
  const teamBIds = players.slice(2, 4).map((p) => p.player_id);
  const myTeam = teamAIds.includes(user.id) ? "A" : teamBIds.includes(user.id) ? "B" : null;
  const lockAlive =
    ms?.result_lock_expires_at != null &&
    new Date(ms.result_lock_expires_at).getTime() > Date.now();
  const lockedByTeammate =
    lockAlive &&
    ms?.result_locked_by != null &&
    ms.result_locked_by !== user.id &&
    ms.result_locked_team != null &&
    ms.result_locked_team === myTeam;
  const canRecord = allowed && n === 4 && !hasFinalResult && !hasPendingProposal && !isDisputed;
  const canConfirm = allowed && n === 4 && hasPendingProposal && rr?.proposed_by !== user.id;
  const resultAffectsLevel = matchTypeAffectsTechnicalRating(
    (m as { match_type?: string | null }).match_type
  );

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-28 pt-6">
      <Link
        href="/home"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-[#0585FC]"
      >
        <ArrowLeft size={18} strokeWidth={2} />
        Volver
      </Link>

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#0585FC]">Partido</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {resultAffectsLevel ? "Competitivo" : "Amistoso"}
        </h1>
      </header>

      <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-lg font-bold text-slate-900">{matchCourtName(m)}</p>
        <p className="text-sm font-medium text-slate-500">{matchClubName(m)}</p>
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <Clock size={16} className="text-[#0585FC]" strokeWidth={2} />
          {when}
        </div>
        <p className="mt-3 text-sm text-slate-600">{n} jugador(es) anotados</p>
        <p className="mt-2 text-xl font-bold text-slate-900">
          {price != null ? `$${price}` : "Consultar precio"}
        </p>
      </article>

      {players.length > 0 ? (
        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-2 text-slate-900">
            <Users size={18} className="text-[#0585FC]" strokeWidth={2} aria-hidden />
            <h2 className="text-sm font-bold tracking-tight">Jugadores</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Equipos A/B: orden por ID
            {resultAffectsLevel ? " (mismo criterio que el ajuste de nivel competitivo)." : "."}
          </p>
          <ul className="mt-3 space-y-2">
            {players.map((mp, idx) => {
              const name = profileName(mp);
              const tag = idx < 2 ? "A" : "B";
              return (
                <li key={mp.player_id} className="flex items-center gap-2 text-sm">
                  <Badge variant="neutral" className="px-2 py-0.5 text-[10px] font-bold">
                    {tag}
                  </Badge>
                  <Link
                    href={`/jugador/${mp.player_id}`}
                    className="font-semibold text-[#0461C4] underline decoration-sky-200/80 underline-offset-2 transition hover:text-[#0585FC]"
                  >
                    {name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {hasFinalResult && rr ? (
        <section className="rounded-3xl border border-emerald-200/80 bg-emerald-50/40 p-5">
          <h2 className="text-sm font-bold text-emerald-900">Resultado cargado</h2>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
            Equipo A <span className="text-emerald-700">{rr.team_a_score}</span>
            <span className="mx-2 font-normal text-slate-400">—</span>
            <span className="text-emerald-700">{rr.team_b_score}</span> Equipo B
          </p>
          <p className="mt-1 text-xs text-slate-600">{teamALabel}</p>
          <p className="text-xs text-slate-600">{teamBLabel}</p>
          {resultAffectsLevel ? (
            <p className="mt-2 text-xs text-emerald-800/90">
              Los niveles técnicos de los 4 jugadores se actualizaron según este resultado
              competitivo.
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-600">
              Partido amistoso: el resultado no modifica el nivel técnico.
            </p>
          )}
        </section>
      ) : null}

      {canRecord ? (
        <MatchResultForm
          matchId={id}
          teamALabel={teamALabel}
          teamBLabel={teamBLabel}
          lockedByTeammate={Boolean(lockedByTeammate)}
          alreadyStarted={Boolean(ms?.result_locked_by === user.id && lockAlive)}
        />
      ) : null}

      {hasPendingProposal && rr ? (
        <section className="rounded-3xl border border-[#0585FC]/20 bg-[#0585FC]/5/60 p-4">
          <p className="text-sm font-semibold text-[#0585FC]">Resultado pendiente de confirmación</p>
          <p className="mt-1 text-xs text-[#0585FC]">
            Score propuesto: {rr.team_a_score} - {rr.team_b_score}. Deben confirmar los 4.
          </p>
        </section>
      ) : null}

      {canConfirm && rr ? (
        <CompetitiveResultConfirmationCard
          matchId={id}
          label={teamALabel.includes(" / ") ? "la dupla rival" : "el rival"}
          scoreLabel={`${rr.team_a_score}-${rr.team_b_score}`}
          confirmCount={confirmCount ?? 0}
          totalPlayers={4}
        />
      ) : null}

      {isDisputed ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50/70 p-4">
          <p className="text-sm font-semibold text-rose-900">Partido impugnado</p>
          <p className="mt-1 text-xs text-rose-700">
            El resultado quedó en conflicto y no impactará niveles hasta resolución.
          </p>
        </section>
      ) : null}

      {!canRecord && allowed && n !== 4 && !hasFinalResult ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Para cargar el resultado hace falta exactamente 4 jugadores anotados.
          {resultAffectsLevel
            ? " Así se puede aplicar el ajuste de nivel competitivo."
            : ""}
        </p>
      ) : null}

      {!allowed ? (
        <p className="text-center text-xs text-slate-500">
          Solo participantes u organizador pueden cargar el resultado.
        </p>
      ) : null}

      <Link
        href="/buscar-partido"
        className="flex w-full items-center justify-center rounded-2xl bg-[#0461C4] py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#0585FC]/50"
      >
        Ver en feed y unirme
      </Link>
    </MotionPage>
  );
}
