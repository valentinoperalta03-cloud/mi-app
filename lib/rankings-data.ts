import { DB_TABLES } from "@/lib/db-tables";
import { classifyCategory } from "@/lib/level-quiz-logic";
import { getAdminClient } from "@/utils/supabase/server";

export type WeeklyTopPlayer = {
  user_id: string;
  wins: number;
  name: string | null;
  avatar_url: string | null;
  level: number | null;
  categoryLabel: string;
};

export type GlobalRankingRow = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  level: number | null;
  categoryLabel: string;
  accent: "elite" | "avanzado" | "intermedio" | "principiante";
};

export type MyRankInfo = {
  position: number;
  total: number;
  name: string | null;
  avatar_url: string | null;
  level: number | null;
  categoryLabel: string;
};

export type RankingsPreview = {
  myGlobalPosition: number | null;
  totalRankedPlayers: number;
  weeklyFirstName: string | null;
};

function accentFromLevel(level: number | null): GlobalRankingRow["accent"] {
  const lv = level ?? 0;
  if (lv >= 6) return "elite";
  if (lv >= 4) return "avanzado";
  if (lv >= 2) return "intermedio";
  return "principiante";
}

/**
 * Top victorias en 7 días: partidos con al menos una fila en `match_result_confirmations`
 * (decisión confirm) creada en la ventana, y resultado final `confirmed` con ganador claro.
 */
export async function fetchWeeklyTopWinners(limit = 10): Promise<WeeklyTopPlayer[]> {
  const admin = await getAdminClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: confRows, error: confErr } = await admin
    .from(DB_TABLES.matchResultConfirmations)
    .select("match_result_id")
    .eq("decision", "confirm")
    .gte("created_at", since);

  if (confErr || !confRows?.length) return [];

  const resultIds = [...new Set((confRows as { match_result_id: string }[]).map((r) => r.match_result_id))];

  const { data: results, error } = await admin
    .from(DB_TABLES.matchResults)
    .select("id, match_id, team_a_score, team_b_score")
    .eq("status", "confirmed")
    .in("id", resultIds);

  if (error || !results?.length) return [];

  const filtered = results.filter(
    (r: {
      team_a_score: number | null;
      team_b_score: number | null;
    }) =>
      r.team_a_score != null &&
      r.team_b_score != null &&
      Number(r.team_a_score) !== Number(r.team_b_score)
  );

  if (!filtered.length) return [];

  const matchIds = [...new Set(filtered.map((r: { match_id: string }) => r.match_id))];

  const { data: parts } = await admin
    .from(DB_TABLES.matchParticipants)
    .select("match_id, player_id, team")
    .in("match_id", matchIds);

  const winCounts = new Map<string, number>();

  for (const r of filtered) {
    const sa = Number(r.team_a_score);
    const sb = Number(r.team_b_score);
    const winningTeam = sa > sb ? 1 : 2;
    for (const p of parts ?? []) {
      if (p.match_id !== r.match_id || p.team !== winningTeam) continue;
      const pid = p.player_id as string;
      winCounts.set(pid, (winCounts.get(pid) ?? 0) + 1);
    }
  }

  const sorted = [...winCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (!sorted.length) return [];

  const ids = sorted.map(([id]) => id);
  const { data: profiles } = await admin
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url, level, level_of_play")
    .in("user_id", ids);

  const byId = new Map(
    (profiles ?? []).map(
      (p: {
        user_id: string;
        name: string | null;
        avatar_url: string | null;
        level: number | null;
        level_of_play: string | null;
      }) => [p.user_id, p]
    )
  );

  return sorted.map(([user_id, wins]) => {
    const p = byId.get(user_id) as
      | { name: string | null; avatar_url: string | null; level: number | null; level_of_play: string | null }
      | undefined;
    const lv = p?.level != null && Number.isFinite(Number(p.level)) ? Number(p.level) : null;
    const categoryLabel =
      (p?.level_of_play && String(p.level_of_play).trim()) || (lv != null ? classifyCategory(lv) : "—");
    return {
      user_id,
      wins,
      name: p?.name ?? null,
      avatar_url: p?.avatar_url ?? null,
      level: lv,
      categoryLabel,
    };
  });
}

export async function fetchGlobalRanking(limit = 50): Promise<GlobalRankingRow[]> {
  const admin = await getAdminClient();
  const { data, error } = await admin
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url, level, level_of_play")
    .order("level", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data) return [];

  return (
    data as Array<{
      user_id: string;
      name: string | null;
      avatar_url: string | null;
      level: number | null;
      level_of_play: string | null;
    }>
  ).map((p) => {
    const lv = p.level != null && Number.isFinite(Number(p.level)) ? Number(p.level) : null;
    const categoryLabel =
      (p.level_of_play && String(p.level_of_play).trim()) || (lv != null ? classifyCategory(lv) : "—");
    return {
      user_id: p.user_id,
      name: p.name,
      avatar_url: p.avatar_url,
      level: lv,
      categoryLabel,
      accent: accentFromLevel(lv),
    };
  });
}

export async function fetchMyGlobalRank(userId: string): Promise<MyRankInfo | null> {
  const admin = await getAdminClient();

  const { data: me, error: meErr } = await admin
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url, level, level_of_play")
    .eq("user_id", userId)
    .maybeSingle();

  if (meErr || !me) return null;

  const { data: ordered, error: ordErr } = await admin
    .from(DB_TABLES.profiles)
    .select("user_id, level")
    .order("level", { ascending: false, nullsFirst: false })
    .order("user_id", { ascending: true });

  if (ordErr || !ordered?.length) return null;

  const rows = ordered as { user_id: string; level: number | null }[];
  const myLevel = me.level != null && Number.isFinite(Number(me.level)) ? Number(me.level) : null;
  const idx = rows.findIndex((r) => r.user_id === userId);
  if (idx === -1) return null;

  const lv = myLevel;
  const meRow = me as { name: string | null; avatar_url: string | null; level_of_play: string | null };
  const categoryLabel =
    (meRow.level_of_play && String(meRow.level_of_play).trim()) || (lv != null ? classifyCategory(lv) : "—");

  return {
    position: idx + 1,
    total: rows.length,
    name: meRow.name,
    avatar_url: meRow.avatar_url,
    level: lv,
    categoryLabel,
  };
}

export async function fetchRankingsPreview(userId: string): Promise<RankingsPreview> {
  const [weekly, my] = await Promise.all([fetchWeeklyTopWinners(1), fetchMyGlobalRank(userId)]);

  return {
    myGlobalPosition: my?.position ?? null,
    totalRankedPlayers: my?.total ?? 0,
    weeklyFirstName: weekly[0]?.name?.trim() || null,
  };
}
