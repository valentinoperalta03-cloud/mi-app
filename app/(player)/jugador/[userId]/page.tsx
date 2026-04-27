import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { ProfileAvatar } from "@/components/profile-avatar";
import { formatDateInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { formatProfileNivelFromRow, splitOfficialCategoryLine } from "@/lib/profile-display";
import { createClient } from "@/utils/supabase/server";
import ProfileSocialActions from "@/components/profile-social-actions";
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
    .select(
      "user_id, name, gender, level, level_of_play, technical_score, age, bio, avatar_url, preferred_hand, court_position, preferred_schedule"
    )
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
    preferred_hand?: string | null;
    court_position?: string | null;
    preferred_schedule?: string | null;
  };

  const displayName = row.name?.trim() || "Jugador";
  const categoriaLabel =
    row.gender === "masculino" ? "Masculino" : row.gender === "femenino" ? "Femenino" : "Mixto";

  let favorited = false;
  let followsBack = false;
  let isMutual = false;
  if (user && !isMe) {
    const [{ data: favRow }, { data: followsBackRow }] = await Promise.all([
      supabase
        .from(DB_TABLES.userFavorites)
        .select("user_id")
        .eq("user_id", user.id)
        .eq("favorite_user_id", userId)
        .maybeSingle(),
      supabase
        .from(DB_TABLES.userFavorites)
        .select("user_id")
        .eq("user_id", userId)
        .eq("favorite_user_id", user.id)
        .maybeSingle(),
    ]);
    favorited = Boolean(favRow);
    followsBack = Boolean(followsBackRow);
    isMutual = favorited && followsBack;
  }
  const nivelLine = formatProfileNivelFromRow(row);
  const nivelParts = splitOfficialCategoryLine(nivelLine);

  const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
    supabase
      .from(DB_TABLES.userFavorites)
      .select("favorite_user_id", { count: "exact", head: true })
      .eq("favorite_user_id", userId),
    supabase
      .from(DB_TABLES.userFavorites)
      .select("favorite_user_id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

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
  const derrotasTotales = normalizedResults.filter((r) => r.resultado === "Derrota").length;
  const empatesTotales = normalizedResults.filter((r) => r.resultado === "Empate").length;
  const eloLabel =
    row.technical_score != null && Number.isFinite(Number(row.technical_score))
      ? Number(row.technical_score).toFixed(2)
      : "Sin ranking";
  const ultimosCinco = normalizedResults
    .sort((a, b) => new Date(b.whenIso).getTime() - new Date(a.whenIso).getTime())
    .slice(0, 5);
  const chartValues = ultimosCinco
    .map((m) => (m.resultado === "Victoria" ? 3 : m.resultado === "Empate" ? 1 : 0))
    .reverse();

  const { data: participantsInMyMatches } = matchIds.length
    ? await supabase
        .from(DB_TABLES.matchParticipants)
        .select("player_id, match_id")
        .in("match_id", matchIds.slice(0, 300))
    : { data: [] };

  const coPlayerCounter = new Map<string, number>();
  for (const row of (participantsInMyMatches ?? []) as Array<{ player_id: string; match_id: string }>) {
    if (row.player_id === userId) continue;
    coPlayerCounter.set(row.player_id, (coPlayerCounter.get(row.player_id) ?? 0) + 1);
  }
  const topCoPlayerIds = [...coPlayerCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  const { data: topCoPlayers } = topCoPlayerIds.length
    ? await supabase
        .from(DB_TABLES.profiles)
        .select("user_id, name")
        .in("user_id", topCoPlayerIds)
    : { data: [] };
  const topCoPlayerMap = new Map(
    (topCoPlayers ?? []).map((p: { user_id: string; name: string | null }) => [p.user_id, p.name?.trim() || "Jugador"])
  );
  const topCoPlayersWithCount = topCoPlayerIds.map((id) => ({
    id,
    name: topCoPlayerMap.get(id) ?? "Jugador",
    count: coPlayerCounter.get(id) ?? 0,
  }));

  const { data: matchesRows } = matchIds.length
    ? await supabase
        .from(DB_TABLES.matches)
        .select("id, court_id")
        .in("id", matchIds.slice(0, 300))
    : { data: [] };
  const courtIds = [...new Set((matchesRows ?? []).map((m: { court_id: string | null }) => m.court_id).filter(Boolean))] as string[];
  const { data: courtsRows } = courtIds.length
    ? await supabase.from(DB_TABLES.courts).select("id, club_id").in("id", courtIds)
    : { data: [] };
  const clubIds = [...new Set((courtsRows ?? []).map((c: { club_id: string | null }) => c.club_id).filter(Boolean))] as string[];
  const { data: clubsRows } = clubIds.length
    ? await supabase.from(DB_TABLES.clubs).select("id, name").in("id", clubIds)
    : { data: [] };
  const clubMap = new Map((clubsRows ?? []).map((c: { id: string; name: string | null }) => [c.id, c.name?.trim() || "Club"]));
  const clubCounter = new Map<string, number>();
  for (const court of (courtsRows ?? []) as Array<{ id: string; club_id: string | null }>) {
    if (!court.club_id) continue;
    clubCounter.set(court.club_id, (clubCounter.get(court.club_id) ?? 0) + 1);
  }
  const topClubs = [...clubCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([clubId, count]) => ({ clubId, count, name: clubMap.get(clubId) ?? "Club" }));

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
        {row.bio?.trim() ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{row.bio.trim()}</p>
        ) : null}
        <p className="mt-2 text-sm text-[#0461C4]">
          <span className="font-bold">{nivelParts.category || "—"}</span>
          {nivelParts.description ? (
            <span className="font-medium text-[#0461C4]">{" - "}{nivelParts.description}</span>
          ) : null}
        </p>
        <p className="mt-1 text-xs font-medium text-slate-500">Categoría: {categoriaLabel}</p>
        <div className="mt-4 flex justify-center gap-8 border-y border-[var(--border-subtle)] py-4">
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--text-primary)]">{followersCount ?? 0}</p>
            <p className="text-xs text-[var(--text-tertiary)]">Seguidores</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--text-primary)]">{followingCount ?? 0}</p>
            <p className="text-xs text-[var(--text-tertiary)]">Siguiendo</p>
          </div>
          {isMutual ? (
            <div className="text-center">
              <p className="text-xl font-bold text-emerald-600">✓</p>
              <p className="text-xs text-emerald-600">Amigos</p>
            </div>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Partidos</p>
            <p className="text-sm font-bold text-slate-900">{partidosJugados}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Seguidores</p>
            <p className="text-sm font-bold text-slate-900">{followersCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Seguidos</p>
            <p className="text-sm font-bold text-slate-900">{followingCount ?? 0}</p>
          </div>
        </div>
      </section>

      <ProfileStatsPanel
        partidosJugados={partidosJugados}
        victoriasTotales={victoriasTotales}
        nivelActual={nivelParts.category || "—"}
        eloRanking={eloLabel}
      />

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Nivel y evolución</h2>
        <div className="rounded-3xl border border-slate-200/80 bg-white px-4 py-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-wide text-slate-400">Últimos 5 partidos</p>
          {chartValues.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Sin resultados suficientes para mostrar el gráfico.</p>
          ) : (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {chartValues.map((v, idx) => (
                <div key={`bar-${idx}`} className="flex flex-col items-center gap-1">
                  <div className="flex h-20 w-full items-end rounded-xl bg-slate-100 p-1">
                    <div
                      className={`w-full rounded-md ${
                        v === 3 ? "bg-emerald-500" : v === 1 ? "bg-amber-400" : "bg-rose-400"
                      }`}
                      style={{ height: `${Math.max(18, (v / 3) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">P{idx + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Preferencias del jugador</h2>
        <div className="space-y-2 rounded-3xl border border-slate-200/80 bg-white px-4 py-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Mano hábil:</span> {row.preferred_hand || "No definida"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Posición en cancha:</span> {row.court_position || "No definida"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Horario favorito:</span> {row.preferred_schedule || "No definido"}
          </p>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Partidos que jugó</h2>
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

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Estadísticas</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Victorias</p>
            <p className="text-lg font-bold text-emerald-600">{victoriasTotales}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Derrotas</p>
            <p className="text-lg font-bold text-rose-500">{derrotasTotales}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Empates</p>
            <p className="text-lg font-bold text-amber-500">{empatesTotales}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Efectividad</p>
            <p className="text-lg font-bold text-[#0461C4]">
              {partidosJugados > 0 ? `${Math.round((victoriasTotales / partidosJugados) * 100)}%` : "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          Jugadores con quien más juega
        </h2>
        {topCoPlayersWithCount.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            {displayName} todavía no tiene suficientes partidos para calcular compañeros frecuentes.
          </p>
        ) : (
          <ul className="space-y-2">
            {topCoPlayersWithCount.map((p) => (
              <li key={p.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                <span className="font-semibold text-slate-900">{displayName}</span> suele jugar con{" "}
                <span className="font-semibold text-[#0461C4]">{p.name}</span> ({p.count} partidos)
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Clubes donde juega {displayName}</h2>
        {topClubs.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            Todavía no hay clubes suficientes para mostrar.
          </p>
        ) : (
          <ul className="space-y-2">
            {topClubs.map((club) => (
              <li key={club.clubId} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                <span className="font-semibold text-slate-900">{club.name}</span> · {club.count} canchas jugadas
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
            <ProfileSocialActions
              targetUserId={userId}
              initialFollowing={favorited}
              followsBack={followsBack}
              isMutual={isMutual}
              isMe={isMe}
            />
          )}
        </div>
      ) : null}
    </MotionPage>
  );
}
