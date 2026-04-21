import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { ProfileAvatar } from "@/components/profile-avatar";
import { formatDateInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { formatProfileNivelFromRow, splitOfficialCategoryLine } from "@/lib/profile-display";
import { createClient } from "@/utils/supabase/server";
import ProfileSocialActions from "./profile-social-actions";
import ProfileStatsPanel from "./profile-stats-panel";

type PageProps = { params: Promise<{ userId: string }> };

export default async function JugadorPublicProfilePage({ params }: PageProps) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isMe = user?.id === userId;

  const { data: profile, error } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, name, gender, level, level_of_play, technical_score, age, bio, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) {
    notFound();
  }

  const row = profile as {
    name: string | null;
    gender?: "masculino" | "femenino" | null;
    level?: number | null;
    level_of_play?: string | null;
    technical_score?: number | null;
    age: number | null;
    bio: string | null;
    avatar_url: string | null;
  };

  const displayName = row.name?.trim() || "Jugador";
  const categoriaLabel =
    row.gender === "masculino" ? "Masculino" : row.gender === "femenino" ? "Femenino" : "Mixto";

  let favorited = false;
  if (user && !isMe) {
    const { data: favRow } = await supabase
      .from(DB_TABLES.userFavorites)
      .select("user_id")
      .eq("user_id", user.id)
      .eq("favorite_user_id", userId)
      .maybeSingle();
    favorited = Boolean(favRow);
  }
  const nivelLine = formatProfileNivelFromRow(row);
  const nivelParts = splitOfficialCategoryLine(nivelLine);

  const { data: participantRows } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("player_id", userId)
    .limit(500);
  const matchIds = [...new Set((participantRows ?? []).map((r: { match_id: string }) => r.match_id))];
  const partidosJugados = matchIds.length;

  type MatchResultJoined = {
    match_id: string;
    team_a_score: number | null;
    team_b_score: number | null;
    created_at: string | null;
    matches:
      | {
          id: string;
          date: string;
          match_participants: { player_id: string }[] | null;
        }
      | {
          id: string;
          date: string;
          match_participants: { player_id: string }[] | null;
        }[]
      | null;
  };

  const { data: resultRows } = matchIds.length
    ? await supabase
        .from(DB_TABLES.matchResults)
        .select(
          "match_id, team_a_score, team_b_score, created_at, matches(id,date,match_participants(player_id))"
        )
        .in("match_id", matchIds.slice(0, 300))
    : { data: [] };

  const normalizedResults = ((resultRows ?? []) as MatchResultJoined[])
    .map((row) => {
      const rawMatch = row.matches;
      const match = Array.isArray(rawMatch) ? rawMatch[0] ?? null : rawMatch;
      if (!match) return null;
      const ordered = (match.match_participants ?? []).map((p) => p.player_id);
      const teamAIds = ordered.slice(0, 2);
      const teamBIds = ordered.slice(2, 4);
      const sa = row.team_a_score;
      const sb = row.team_b_score;
      if (sa == null || sb == null) return null;
      const userTeam = teamAIds.includes(userId) ? "A" : teamBIds.includes(userId) ? "B" : null;
      if (!userTeam) return null;
      const gano = userTeam === "A" ? sa > sb : sb > sa;
      const resultado = sa === sb ? "Empate" : gano ? "Victoria" : "Derrota";
      return {
        matchId: row.match_id,
        whenIso: row.created_at ?? match.date,
        scoreLabel: `${sa} — ${sb}`,
        resultado,
        gano,
      };
    })
    .filter(Boolean) as Array<{
    matchId: string;
    whenIso: string;
    scoreLabel: string;
    resultado: "Victoria" | "Derrota" | "Empate";
    gano: boolean;
  }>;

  const victoriasTotales = normalizedResults.filter((r) => r.resultado === "Victoria").length;
  const eloLabel =
    row.technical_score != null && Number.isFinite(Number(row.technical_score))
      ? Number(row.technical_score).toFixed(2)
      : "Sin ranking";
  const ultimosCinco = normalizedResults
    .sort((a, b) => new Date(b.whenIso).getTime() - new Date(a.whenIso).getTime())
    .slice(0, 5);

  return (
    <MotionPage className="relative mx-auto min-h-screen w-full max-w-md bg-gradient-to-b from-slate-50 to-white px-4 pb-32 pt-6">
      <Link
        href="/home"
        className="mb-4 inline-block text-sm font-semibold text-slate-600 transition hover:text-[#0585FC]"
      >
        ← Volver
      </Link>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 text-center shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
        <div className="mx-auto mb-4 w-fit rounded-xl border border-slate-200/70 bg-white/90 p-1.5">
          <div className="relative h-7 w-20 overflow-hidden">
            <Image src="/logo-marca.png" alt="Logo de Padelibre" fill className="object-contain" />
          </div>
        </div>
        <div className="mx-auto w-fit">
          <div className="rounded-full border border-slate-200 bg-white p-1 shadow-[0_8px_20px_-14px_rgba(15,23,42,0.35)]">
            <ProfileAvatar avatarUrl={row.avatar_url} name={displayName} size={108} />
          </div>
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">{displayName}</h1>
        <p className="mt-2 text-sm text-[#0461C4]">
          <span className="font-bold">{nivelParts.category || "—"}</span>
          {nivelParts.description ? (
            <span className="font-medium text-[#0461C4]">{" - "}{nivelParts.description}</span>
          ) : null}
        </p>
        <p className="mt-1 text-xs font-medium text-slate-500">Categoría: {categoriaLabel}</p>
      </section>

      <ProfileStatsPanel
        partidosJugados={partidosJugados}
        victoriasTotales={victoriasTotales}
        nivelActual={nivelParts.category || "—"}
        eloRanking={eloLabel}
      />

      {(row.age != null && row.age > 0) || row.bio?.trim() ? (
        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Sobre el jugador</h2>
          {row.age != null && row.age > 0 ? (
            <p className="rounded-3xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-700 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
              <span className="font-semibold text-slate-900">Edad:</span> {row.age} años
            </p>
          ) : null}
          {row.bio?.trim() ? (
            <p className="rounded-3xl border border-slate-200/80 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
              {row.bio.trim()}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Últimos partidos</h2>
        {ultimosCinco.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            Todavía no hay partidos con resultado para mostrar.
          </p>
        ) : (
          <ul className="space-y-2">
            {ultimosCinco.map((item) => (
              <li
                key={`${item.matchId}-${item.whenIso}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
              >
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    {formatDateInArgentina(item.whenIso, { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                  <p className="text-sm font-semibold text-slate-800">{item.scoreLabel}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.resultado === "Victoria"
                      ? "bg-emerald-100 text-emerald-800"
                      : item.resultado === "Derrota"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {item.resultado}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user ? (
        <div className="mt-6">
          {isMe ? (
            <Link
              href="/perfil/editar"
              className="block rounded-2xl bg-[color:var(--color-brand-mid)] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[color:var(--color-brand-light)] active:scale-[0.98]"
            >
              Editar mi perfil
            </Link>
          ) : (
            <ProfileSocialActions userId={userId} initialFavorited={favorited} />
          )}
        </div>
      ) : null}
    </MotionPage>
  );
}
