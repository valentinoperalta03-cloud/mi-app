import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import {
  calculateLevelChange,
  matchTypeAffectsTechnicalRating,
  shouldUpdateLevelOfPlayString,
  type TeamRoster,
} from "@/lib/level-logic";
import {
  bandFromTechnicalScore,
  clampTechnicalScore,
  formatTechnicalLevelDisplay,
} from "@/lib/technical-score";

const DEFAULT_TECH = 2.5;

function readTechnicalScore(row: { technical_score?: number | null } | null): number {
  const v = row?.technical_score;
  if (v == null || !Number.isFinite(Number(v))) return DEFAULT_TECH;
  return clampTechnicalScore(Number(v));
}

export type ApplyTechnicalRatingResult = {
  ok: boolean;
  message: string;
  /** true si se recalcularon niveles (partido competitivo, no empate, 4 jugadores). */
  ratingApplied: boolean;
};

/**
 * Equipos fijos por orden estable: participantes ordenados por `player_id` asc.
 * Índices 0–1 = equipo A, 2–3 = equipo B (dobles).
 *
 * Solo `match_type === 'competitivo'` aplica cambios; amistoso no toca `technical_score`.
 */
export async function applyTechnicalRatingAfterMatchResult(
  supabase: SupabaseClient,
  params: { matchId: string; teamAScore: number; teamBScore: number }
): Promise<ApplyTechnicalRatingResult> {
  const { matchId, teamAScore, teamBScore } = params;

  const { data: matchMeta, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select("match_type")
    .eq("id", matchId)
    .maybeSingle();

  if (mErr) {
    return { ok: false, message: mErr.message, ratingApplied: false };
  }

  const matchType = (matchMeta as { match_type?: string | null } | null)?.match_type;
  if (!matchTypeAffectsTechnicalRating(matchType)) {
    return {
      ok: true,
      message: "Partido no competitivo: el nivel técnico no se modifica.",
      ratingApplied: false,
    };
  }

  if (teamAScore === teamBScore) {
    return {
      ok: true,
      message: "Empate: no se ajustó el nivel técnico.",
      ratingApplied: false,
    };
  }

  const { data: parts, error: pErr } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id")
    .eq("match_id", matchId)
    .order("player_id", { ascending: true });

  if (pErr || !parts?.length) {
    return { ok: false, message: pErr?.message ?? "No hay participantes para este partido.", ratingApplied: false };
  }

  if (parts.length !== 4) {
    return {
      ok: false,
      message: "El nivel competitivo requiere exactamente 4 jugadores anotados.",
      ratingApplied: false,
    };
  }

  const orderedIds = parts.map((r: { player_id: string }) => r.player_id);
  const teamAIds = [orderedIds[0]!, orderedIds[1]!];
  const teamBIds = [orderedIds[2]!, orderedIds[3]!];

  const { data: profs, error: profErr } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, technical_score")
    .in("user_id", orderedIds);

  if (profErr || !profs?.length) {
    return { ok: false, message: profErr?.message ?? "No se pudieron leer los perfiles.", ratingApplied: false };
  }

  const scoreById = new Map(
    (profs as { user_id: string; technical_score?: number | null }[]).map((p) => [
      p.user_id,
      readTechnicalScore(p),
    ])
  );

  const teamA: TeamRoster = teamAIds.map((id) => ({
    playerId: id,
    technicalScore: scoreById.get(id) ?? DEFAULT_TECH,
  }));
  const teamB: TeamRoster = teamBIds.map((id) => ({
    playerId: id,
    technicalScore: scoreById.get(id) ?? DEFAULT_TECH,
  }));

  const aWins = teamAScore > teamBScore;
  const winners = aWins ? teamA : teamB;
  const losers = aWins ? teamB : teamA;

  const deltas = calculateLevelChange({ winners, losers });

  for (const { playerId, delta } of deltas) {
    const prev = scoreById.get(playerId) ?? DEFAULT_TECH;
    const next = clampTechnicalScore(prev + delta);
    scoreById.set(playerId, next);

    const updatePayload: Record<string, unknown> = {
      technical_score: next,
    };
    if (shouldUpdateLevelOfPlayString(prev, next)) {
      updatePayload.level_of_play = formatTechnicalLevelDisplay(next);
    }

    const { error: upErr } = await supabase
      .from(DB_TABLES.profiles)
      .update(updatePayload)
      .eq("user_id", playerId);

    if (upErr) {
      return { ok: false, message: `Error actualizando perfil (${playerId}): ${upErr.message}`, ratingApplied: false };
    }

    const { error: evErr } = await supabase.from(DB_TABLES.levelEvolution).insert({
      user_id: playerId,
      score: next,
      category: bandFromTechnicalScore(next),
      previous_score: prev,
      new_score: next,
    });

    if (evErr) {
      return { ok: false, message: `Error en historial de nivel: ${evErr.message}`, ratingApplied: false };
    }
  }

  return { ok: true, message: "Niveles técnicos actualizados.", ratingApplied: true };
}
