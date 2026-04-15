import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock, Users } from "lucide-react";
import MotionPage from "@/components/motion-page";
import { MatchResultForm } from "@/components/match-result-form";
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
    .select("team_a_score, team_b_score")
    .eq("match_id", id)
    .maybeSingle();

  const rr = resultRow as { team_a_score: number | null; team_b_score: number | null } | null;
  const hasResult =
    rr != null &&
    rr.team_a_score != null &&
    rr.team_b_score != null &&
    Number.isFinite(Number(rr.team_a_score)) &&
    Number.isFinite(Number(rr.team_b_score));

  const names = players.map(profileName);
  const teamALabel =
    n >= 2 ? `Equipo A (${names[0] ?? "—"} / ${names[1] ?? "—"})` : "Equipo A";
  const teamBLabel =
    n >= 4 ? `Equipo B (${names[2] ?? "—"} / ${names[3] ?? "—"})` : "Equipo B";

  const canRecord = allowed && n === 4 && !hasResult;
  const resultAffectsLevel = matchTypeAffectsTechnicalRating(
    (m as { match_type?: string | null }).match_type
  );

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-28 pt-6">
      <Link
        href="/home"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-sky-600"
      >
        <ArrowLeft size={18} strokeWidth={2} />
        Volver
      </Link>

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Partido</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {resultAffectsLevel ? "Competitivo" : "Amistoso"}
        </h1>
      </header>

      <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-lg font-bold text-slate-900">{matchCourtName(m)}</p>
        <p className="text-sm font-medium text-slate-500">{matchClubName(m)}</p>
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <Clock size={16} className="text-sky-600" strokeWidth={2} />
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
            <Users size={18} className="text-sky-600" strokeWidth={2} aria-hidden />
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
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {tag}
                  </span>
                  <Link
                    href={`/jugador/${mp.player_id}`}
                    className="font-semibold text-sky-700 underline decoration-sky-200/80 underline-offset-2 transition hover:text-sky-800"
                  >
                    {name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {hasResult && rr ? (
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
          resultAffectsTechnicalLevel={resultAffectsLevel}
        />
      ) : null}

      {!canRecord && allowed && n !== 4 && !hasResult ? (
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
        className="flex w-full items-center justify-center rounded-2xl bg-sky-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-sky-500"
      >
        Ver en feed y unirme
      </Link>
    </MotionPage>
  );
}
