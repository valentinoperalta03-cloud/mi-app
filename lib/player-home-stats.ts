import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

const LEVEL_SCORE: Record<string, number> = {
  beginner: 1,
  inicial: 1,
  intermedio: 2,
  intermediate: 2,
  advanced: 3,
  avanzado: 3,
  pro: 4,
};

function levelToDisplayNumber(level: string | null | undefined): number {
  if (level == null || level === "") return 0;
  const t = String(level).trim().toLowerCase();
  const n = Number(t);
  if (!Number.isNaN(n) && n > 0) return Math.min(10, Math.round(n));
  return LEVEL_SCORE[t] ?? 1;
}

export type PlayerHomeStats = {
  partidosCount: number;
  reservasCount: number;
  nivelDisplay: number;
};

export async function fetchPlayerHomeStats(
  supabase: SupabaseClient,
  userId: string
): Promise<PlayerHomeStats> {
  const [{ count: partidosCount }, { count: reservasCount }, { data: profile }] = await Promise.all([
    supabase
      .from(DB_TABLES.matchPlayers)
      .select("match_id", { count: "exact", head: true })
      .eq("player_id", userId),
    supabase
      .from(DB_TABLES.matches)
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId),
    supabase.from(DB_TABLES.profiles).select("level").eq("user_id", userId).maybeSingle(),
  ]);

  const nivelDisplay = levelToDisplayNumber(
    (profile as { level?: string | null } | null)?.level ?? null
  );

  return {
    partidosCount: partidosCount ?? 0,
    reservasCount: reservasCount ?? 0,
    nivelDisplay,
  };
}
