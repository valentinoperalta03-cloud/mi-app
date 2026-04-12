import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

export type ActivityPeer = {
  player_id: string;
  name: string;
};

export type FinishedMatchActivity = {
  resultId: string;
  matchId: string;
  finishedAt: string | null;
  matchDateIso: string;
  clubName: string;
  courtName: string;
  scoreLabel: string | null;
  peers: ActivityPeer[];
  unratedPeerIds: string[];
};

type RawPlayer = {
  player_id: string;
  profiles:
    | { user_id?: string; name: string | null }
    | { user_id?: string; name: string | null }[]
    | null;
};

type RawMatch = {
  id: string;
  date: string;
  courts: unknown;
  match_players: RawPlayer[] | null;
};

function unwrapEmbedded<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function namesFromMatch(match: RawMatch): { courtName: string; clubName: string } {
  const court = unwrapEmbedded(match.courts) as
    | {
        name?: string | null;
        clubs?: { name?: string | null } | { name?: string | null }[] | null;
      }
    | null;
  const courtName = court?.name?.trim() || "Cancha";
  const club = unwrapEmbedded(court?.clubs ?? null);
  const clubName = club?.name?.trim() || "Club";
  return { courtName, clubName };
}

/**
 * Partidos finalizados (`match_results`) en los que participó el usuario,
 * con rivales y cuáles faltan calificar según `player_ratings`.
 */
export async function fetchFinishedMatchActivity(
  supabase: SupabaseClient,
  userId: string
): Promise<FinishedMatchActivity[]> {
  const { data: participation } = await supabase
    .from(DB_TABLES.matchPlayers)
    .select("match_id")
    .eq("player_id", userId);

  const matchIds = [...new Set((participation ?? []).map((r: { match_id: string }) => r.match_id))];
  if (matchIds.length === 0) return [];

  const { data: resultsRaw, error } = await supabase
    .from(DB_TABLES.matchResults)
    .select(
      `
      id,
      match_id,
      created_at,
      team_a_score,
      team_b_score,
      matches (
        id,
        date,
        courts (
          name,
          clubs ( name )
        ),
        match_players (
          player_id,
          profiles ( user_id, name )
        )
      )
    `
    )
    .in("match_id", matchIds);

  if (error || !resultsRaw?.length) return [];

  const resultMatchIds = (resultsRaw as { match_id: string }[]).map((r) => r.match_id);

  const { data: myRatings } = await supabase
    .from(DB_TABLES.playerRatings)
    .select("match_id, rated_id")
    .eq("rater_id", userId)
    .in("match_id", resultMatchIds);

  const ratedKey = new Set(
    (myRatings ?? []).map((x: { match_id: string; rated_id: string }) => `${x.match_id}:${x.rated_id}`)
  );

  const activities: FinishedMatchActivity[] = [];

  const rows = resultsRaw as unknown as {
    id: string;
    match_id: string;
    created_at?: string | null;
    team_a_score?: number | null;
    team_b_score?: number | null;
    matches: RawMatch | RawMatch[] | null;
  }[];

  for (const row of rows) {
    const match = unwrapEmbedded(row.matches);
    if (!match?.id || !match.date) continue;

    const { courtName, clubName } = namesFromMatch(match);

    const peers: ActivityPeer[] = (match.match_players ?? [])
      .filter((p) => p.player_id !== userId)
      .map((p) => {
        const prof = p.profiles;
        const profile = Array.isArray(prof) ? prof[0] : prof;
        return {
          player_id: p.player_id,
          name: profile?.name?.trim() || "Jugador",
        };
      });

    const unratedPeerIds = peers
      .filter((p) => !ratedKey.has(`${row.match_id}:${p.player_id}`))
      .map((p) => p.player_id);

    const sa = row.team_a_score;
    const sb = row.team_b_score;
    const scoreLabel = sa != null && sb != null ? `${sa} — ${sb}` : null;

    activities.push({
      resultId: row.id,
      matchId: row.match_id,
      finishedAt: row.created_at ?? null,
      matchDateIso: match.date,
      clubName,
      courtName,
      scoreLabel,
      peers,
      unratedPeerIds,
    });
  }

  activities.sort((a, b) => {
    const ta = new Date(a.finishedAt ?? a.matchDateIso).getTime();
    const tb = new Date(b.finishedAt ?? b.matchDateIso).getTime();
    return tb - ta;
  });

  return activities;
}
