import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { formatProfileNivel } from "@/lib/profile-display";

export type HomeSummary = {
  matchesPlayed: number;
  activeReservasCount: number;
  nivelLine: string;
};

/**
 * Resumen para Home: partidos jugados (perfil), reservas activas (partidos futuros creados por el usuario), nivel.
 */
export async function fetchHomeSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<HomeSummary> {
  const nowIso = new Date().toISOString();

  const [{ data: profile }, { count }] = await Promise.all([
    supabase
      .from(DB_TABLES.profiles)
      .select("matches_played, category, level")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from(DB_TABLES.matches)
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId)
      .gte("date", nowIso),
  ]);

  const row = profile as {
    matches_played?: number | null;
    category?: string | null;
    level?: string | number | null;
  } | null;

  return {
    matchesPlayed: row?.matches_played ?? 0,
    activeReservasCount: count ?? 0,
    nivelLine: formatProfileNivel(row?.category, row?.level),
  };
}
