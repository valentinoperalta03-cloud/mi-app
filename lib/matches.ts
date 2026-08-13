import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import type { MatchWithRelations } from "@/lib/database.types";

export const matchListSelect = `
  id,
  date,
  court_id,
  owner_id,
  is_competitive,
  match_type,
  gender_category,
  courts (
    id,
    name,
    club_id,
    price,
    clubs (
      id,
      name,
      location
    )
  ),
  match_participants (
    player_id,
    profiles (
      user_id,
      name,
      avatar_url,
      gender,
      category
    )
  )
`;

export async function fetchUpcomingMatches(
  supabase: SupabaseClient,
  options: { limit?: number } = {}
) {
  const limit = options.limit ?? 20;
  return supabase
    .from(DB_TABLES.matches)
    .select(matchListSelect)
    .gte("date", new Date().toISOString())
    .order("date", { ascending: true })
    .limit(limit);
}

export type UpcomingMatchRow = MatchWithRelations & {
  owner_id?: string | null;
  is_competitive?: boolean | null;
  match_type?: string | null;
};

function firstCourtEmbed(m: UpcomingMatchRow): Record<string, unknown> | null {
  const c = m.courts as unknown;
  if (Array.isArray(c)) {
    const row = c[0] as Record<string, unknown> | undefined;
    return row ?? null;
  }
  return (c as Record<string, unknown> | null) ?? null;
}

/** PostgREST a veces tipa FK como array; normalizamos para mostrar nombre del club. */
export function matchClubName(m: UpcomingMatchRow): string {
  const court = firstCourtEmbed(m);
  const rel = court?.clubs as
    | { name?: string | null }
    | { name?: string | null }[]
    | null
    | undefined;
  if (!rel) return "Club";
  const first = Array.isArray(rel) ? rel[0] : rel;
  return first?.name ?? "Club";
}

export function matchCourtName(m: UpcomingMatchRow): string {
  const court = firstCourtEmbed(m);
  const n = court?.name;
  return typeof n === "string" && n ? n : "Cancha";
}

export function matchCourtPrice(m: UpcomingMatchRow): number | null {
  const court = firstCourtEmbed(m);
  const p = court?.price;
  return typeof p === "number" ? p : null;
}

/** Próximo partido futuro donde el usuario creó el match o está anotado en match_participants. */
export async function fetchNextMatchForPlayer(
  supabase: SupabaseClient,
  userId: string
): Promise<UpcomingMatchRow | null> {
  const now = new Date().toISOString();

  const [{ data: created }, { data: playerRows }] = await Promise.all([
    supabase
      .from(DB_TABLES.matches)
      .select(matchListSelect)
      .eq("owner_id", userId)
      .gte("date", now)
      .neq("match_status", "cancelled")
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from(DB_TABLES.matchParticipants).select("match_id").eq("player_id", userId),
  ]);

  const createdMatch = created as UpcomingMatchRow | null;
  const ids = [...new Set((playerRows ?? []).map((r: { match_id: string }) => r.match_id))];

  let joinedMatch: UpcomingMatchRow | null = null;
  if (ids.length > 0) {
    const { data } = await supabase
      .from(DB_TABLES.matches)
      .select(matchListSelect)
      .in("id", ids)
      .gte("date", now)
      .neq("match_status", "cancelled")
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();
    joinedMatch = data as UpcomingMatchRow | null;
  }

  if (!createdMatch && !joinedMatch) return null;
  if (!createdMatch) return joinedMatch;
  if (!joinedMatch) return createdMatch;
  return new Date(createdMatch.date) <= new Date(joinedMatch.date) ? createdMatch : joinedMatch;
}

export async function fetchMatchById(supabase: SupabaseClient, matchId: string) {
  return supabase.from(DB_TABLES.matches).select(matchListSelect).eq("id", matchId).maybeSingle();
}

export async function fetchMatchesForCourtsOnDay(
  supabase: SupabaseClient,
  courtIds: string[],
  dayStartIso: string,
  dayEndIso: string
) {
  if (courtIds.length === 0) {
    return {
      data: [] as { id: string; date: string; court_id: string }[],
      error: null,
    };
  }
  return supabase
    .from(DB_TABLES.matches)
    .select("id, date, court_id")
    .in("court_id", courtIds)
    .gte("date", dayStartIso)
    .lte("date", dayEndIso);
}
