import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { formatPlayerCategory } from "@/lib/profile-display";

export type HomeSummary = {
  matchesPlayed: number;
  activeReservasCount: number;
  nivelLine: string;
};

/** Resumen para Home: reservas activas (partidos futuros con `owner_id` = usuario) y categoría. */
export async function fetchHomeSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<HomeSummary> {
  const nowIso = new Date().toISOString();

  const [{ data: profile }, { count }] = await Promise.all([
    supabase
      .from(DB_TABLES.profiles)
      .select("category")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from(DB_TABLES.matches)
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .gte("date", nowIso),
  ]);

  const row = profile as { category?: string | null } | null;

  return {
    matchesPlayed: 0,
    activeReservasCount: count ?? 0,
    nivelLine: formatPlayerCategory(row?.category),
  };
}
