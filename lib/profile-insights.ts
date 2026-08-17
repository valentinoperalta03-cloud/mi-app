import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

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
