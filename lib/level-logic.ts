/**
 * Motor de nivelación por partidos (solo `matches.match_type === 'competitivo'`).
 * Escala 0.0–7.0, suma cero, intercambio proporcional y freno de élite ≥ 5.0.
 */

import { bandFromTechnicalScore } from "@/lib/technical-score";

export const LEVEL_DELTA_MIN = 0.001;
export const LEVEL_DELTA_MAX = 0.3;

/** Solo estos partidos disparan cambios en `technical_score`. */
export function matchTypeAffectsTechnicalRating(matchType: string | null | undefined): boolean {
  return String(matchType ?? "").toLowerCase().trim() === "competitivo";
}

/**
 * Freno de élite: a partir de 3ra (puntuación ≥ 5.0), ganar y perder va a mitad de velocidad.
 */
export function eliteMovementMultiplier(technicalScore: number): number {
  return technicalScore >= 5 ? 0.5 : 1;
}

/**
 * Magnitud base positiva del intercambio según meritocracia (parejas en promedio).
 * `upset = avgLosers - avgWinners` (positivo si el ganador iba más débil en papel).
 */
export function computeBaseDeltaMagnitude(avgWinners: number, avgLosers: number): number {
  const upset = avgLosers - avgWinners;
  const t = Math.max(-3, Math.min(3, upset)) / 3;
  const u = (t + 1) / 2;
  return LEVEL_DELTA_MIN + u * (LEVEL_DELTA_MAX - LEVEL_DELTA_MIN);
}

export type TeamRoster = { playerId: string; technicalScore: number }[];

/**
 * Reparto suma cero:
 * - Cada ganador suma `baseDelta * eliteMult(su nivel)`.
 * - Cada perdedor paga una fracción del total proporcional a su `eliteMult` (misma regla: ganar y perder más lento en élite).
 */
export function calculateLevelChange(params: {
  winners: TeamRoster;
  losers: TeamRoster;
}): { playerId: string; delta: number }[] {
  const { winners, losers } = params;
  if (winners.length !== 2 || losers.length !== 2) {
    throw new Error("calculateLevelChange requiere 2 ganadores y 2 perdedores (dobles).");
  }

  const avgW = winners.reduce((a, p) => a + p.technicalScore, 0) / winners.length;
  const avgL = losers.reduce((a, p) => a + p.technicalScore, 0) / losers.length;
  const baseDelta = computeBaseDeltaMagnitude(avgW, avgL);

  const winGains = winners.map((p) => ({
    playerId: p.playerId,
    delta: baseDelta * eliteMovementMultiplier(p.technicalScore),
  }));
  const totalWin = winGains.reduce((a, g) => a + g.delta, 0);

  const m0 = eliteMovementMultiplier(losers[0]!.technicalScore);
  const m1 = eliteMovementMultiplier(losers[1]!.technicalScore);
  const mSum = m0 + m1;
  const loss0 = -totalWin * (m0 / mSum);
  const loss1 = -totalWin * (m1 / mSum);

  return [
    ...winGains,
    { playerId: losers[0]!.playerId, delta: loss0 },
    { playerId: losers[1]!.playerId, delta: loss1 },
  ];
}

/** `level_of_play` en BD solo se sincroniza cuando cruza el entero de banda (tramo 0–1, 1–2, …). */
export function shouldUpdateLevelOfPlayString(prevScore: number, nextScore: number): boolean {
  return bandFromTechnicalScore(prevScore) !== bandFromTechnicalScore(nextScore);
}
