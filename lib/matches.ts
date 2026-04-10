import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import type { MatchWithRelations } from "@/lib/database.types";

const matchListSelect = `
  id,
  date,
  court_id,
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
  match_players ( player_id )
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

export type UpcomingMatchRow = MatchWithRelations;

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
