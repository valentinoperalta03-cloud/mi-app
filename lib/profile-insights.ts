import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

export type EvolutionPoint = {
  created_at: string;
  /** Valor para el gráfico: preferentemente `new_score` (histórico decimal). */
  score: number;
  category: string;
  previous_score?: number | null;
  new_score?: number | null;
};

export type ProfileMatchCard = {
  resultId: string;
  matchId: string;
  whenIso: string;
  clubName: string;
  courtName: string;
  scoreLabel: string | null;
};

export type CoplayerStat = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  sharedMatches: number;
};

export type ClubStat = {
  club_id: string;
  name: string;
  count: number;
};

function unwrapCourtClub(
  courts: unknown
): { courtName: string; clubName: string } {
  const c = Array.isArray(courts) ? courts[0] : courts;
  const court = c as { name?: string | null; clubs?: unknown } | null;
  const courtName = court?.name?.trim() || "Cancha";
  const cl = court?.clubs;
  const club = Array.isArray(cl) ? cl[0] : cl;
  const clubName = (club as { name?: string | null } | null)?.name?.trim() || "Club";
  return { courtName, clubName };
}

export async function fetchLevelEvolutionSeries(
  supabase: SupabaseClient,
  userId: string
): Promise<EvolutionPoint[]> {
  const { data } = await supabase
    .from(DB_TABLES.levelEvolution)
    .select("created_at, score, category, previous_score, new_score")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const raw = (data ?? []) as {
    created_at: string;
    score: number | string | null;
    category: string | null;
    previous_score?: number | string | null;
    new_score?: number | string | null;
  }[];

  return raw.map((r) => {
    const ns = r.new_score != null && r.new_score !== "" ? Number(r.new_score) : NaN;
    const sc = r.score != null && r.score !== "" ? Number(r.score) : NaN;
    const resolved = Number.isFinite(ns) ? ns : Number.isFinite(sc) ? sc : 0;
    const ps = r.previous_score != null && r.previous_score !== "" ? Number(r.previous_score) : null;
    return {
      created_at: r.created_at,
      score: resolved,
      category: (r.category ?? "").trim() || "—",
      previous_score: ps != null && Number.isFinite(ps) ? ps : null,
      new_score: Number.isFinite(ns) ? ns : null,
    };
  });
}

export async function fetchProfileMatchCards(
  supabase: SupabaseClient,
  userId: string,
  limit: number
): Promise<ProfileMatchCard[]> {
  const { data: mp } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("player_id", userId)
    .limit(500);

  const idList = [...new Set((mp ?? []).map((r: { match_id: string }) => r.match_id))];
  if (idList.length === 0) return [];

  const { data: matches } = await supabase
    .from(DB_TABLES.matches)
    .select(
      `
      id,
      date,
      courts ( name, clubs ( name ) )
    `
    )
    .in("id", idList.length > 280 ? idList.slice(0, 280) : idList)
    .order("date", { ascending: false })
    .limit(Math.max(limit * 5, 24));

  const ordered = (matches ?? []) as { id: string; date: string; courts: unknown }[];
  if (ordered.length === 0) return [];

  const mids = ordered.map((m) => m.id);
  const { data: results } = await supabase
    .from(DB_TABLES.matchResults)
    .select("id, match_id, created_at, team_a_score, team_b_score")
    .in("match_id", mids);

  const resByMatch = new Map<
    string,
    {
      id: string;
      match_id: string;
      created_at: string | null;
      team_a_score: number | null;
      team_b_score: number | null;
    }
  >();
  for (const raw of results ?? []) {
    const r = raw as {
      id: string;
      match_id: string;
      created_at: string | null;
      team_a_score: number | null;
      team_b_score: number | null;
    };
    if (!resByMatch.has(r.match_id)) resByMatch.set(r.match_id, r);
  }

  const withResults = ordered.filter((m) => resByMatch.has(m.id)).slice(0, limit);

  return withResults.map((meta) => {
    const r = resByMatch.get(meta.id)!;
    const { courtName, clubName } = unwrapCourtClub(meta.courts ?? null);
    const sa = r.team_a_score;
    const sb = r.team_b_score;
    const scoreLabel = sa != null && sb != null ? `${sa} — ${sb}` : null;
    return {
      resultId: r.id,
      matchId: meta.id,
      whenIso: meta.date ?? r.created_at ?? new Date().toISOString(),
      clubName,
      courtName,
      scoreLabel,
    };
  });
}

export async function fetchTopCoplayers(
  supabase: SupabaseClient,
  userId: string,
  top = 5
): Promise<CoplayerStat[]> {
  const { data: mp } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("player_id", userId)
    .limit(400);

  const playedIds = [...new Set((mp ?? []).map((r: { match_id: string }) => r.match_id))];
  if (playedIds.length === 0) return [];

  const { data: recentMatches } = await supabase
    .from(DB_TABLES.matches)
    .select("id")
    .in("id", playedIds.length > 300 ? playedIds.slice(0, 300) : playedIds)
    .order("date", { ascending: false })
    .limit(80);

  const matchIds = (recentMatches ?? []).map((m: { id: string }) => m.id);
  if (matchIds.length === 0) return [];

  const { data: allPlayers } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id, match_id")
    .in("match_id", matchIds);

  const counts = new Map<string, number>();
  for (const row of allPlayers ?? []) {
    const p = (row as { player_id: string }).player_id;
    if (p === userId) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
  if (sorted.length === 0) return [];

  const ids = sorted.map(([id]) => id);
  const { data: profs } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url")
    .in("user_id", ids);

  const pmap = new Map(
    (profs ?? []).map(
      (p: { user_id: string; name: string | null; avatar_url: string | null }) => [
        p.user_id,
        p,
      ]
    )
  );

  return sorted.map(([uid, n]) => {
    const pr = pmap.get(uid);
    return {
      user_id: uid,
      name: pr?.name?.trim() || "Jugador",
      avatar_url: pr?.avatar_url ?? null,
      sharedMatches: n,
    };
  });
}

export async function fetchTopClubsByReservations(
  supabase: SupabaseClient,
  userId: string,
  top = 5
): Promise<ClubStat[]> {
  const { data: matches } = await supabase
    .from(DB_TABLES.matches)
    .select("court_id")
    .eq("owner_id", userId)
    .limit(400);

  const courtIds = (matches ?? []).map((m: { court_id: string }) => m.court_id).filter(Boolean);
  if (courtIds.length === 0) return [];

  const courtCount = new Map<string, number>();
  for (const cid of courtIds) {
    courtCount.set(cid, (courtCount.get(cid) ?? 0) + 1);
  }

  const { data: courts } = await supabase
    .from(DB_TABLES.courts)
    .select("id, club_id")
    .in("id", [...courtCount.keys()]);

  const clubTotals = new Map<string, number>();
  for (const c of courts ?? []) {
    const row = c as { id: string; club_id: string };
    const n = courtCount.get(row.id) ?? 0;
    clubTotals.set(row.club_id, (clubTotals.get(row.club_id) ?? 0) + n);
  }

  const sorted = [...clubTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
  if (sorted.length === 0) return [];

  const clubIds = sorted.map(([id]) => id);
  const { data: clubs } = await supabase
    .from(DB_TABLES.clubs)
    .select("id, name")
    .in("id", clubIds);

  const cmap = new Map((clubs ?? []).map((c: { id: string; name: string | null }) => [c.id, c.name]));

  return sorted.map(([club_id, count]) => ({
    club_id,
    name: cmap.get(club_id)?.trim() || "Club",
    count,
  }));
}
