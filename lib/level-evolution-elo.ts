/**
 * ELO competitivo (escala `profiles.level` 0–8).
 * Solo partidos competitivos deben invocar `computeEloDelta`.
 */

export type EloParams = {
  playerLevel: number;
  partnerLevel: number;
  opponentAvgLevel: number;
  outcome: "win" | "loss";
  setsWon: number;
  setsLost: number;
  totalMatchesPlayed: number;
  /** Multiplicador extra (p. ej. 1.5 en torneos competitivos). */
  deltaMultiplier?: number;
};

export function eloKForExperience(totalMatchesPlayed: number): number {
  if (totalMatchesPlayed < 10) return 0.4;
  if (totalMatchesPlayed < 30) return 0.2;
  if (totalMatchesPlayed < 60) return 0.12;
  return 0.07;
}

/**
 * Delta sugerido para actualizar `profiles.level` tras un partido competitivo.
 */
export function computeEloDelta(params: EloParams): number {
  const { playerLevel, partnerLevel, opponentAvgLevel, outcome, setsWon, setsLost, totalMatchesPlayed } = params;

  let k: number;
  if (totalMatchesPlayed < 10) k = 0.4;
  else if (totalMatchesPlayed < 30) k = 0.2;
  else if (totalMatchesPlayed < 60) k = 0.12;
  else k = 0.07;

  const levelDiff = opponentAvgLevel - playerLevel;
  let difficulty: number;
  if (levelDiff >= 2) difficulty = 2.0;
  else if (levelDiff >= 1) difficulty = 1.5;
  else if (levelDiff >= -1) difficulty = 1.0;
  else if (levelDiff >= -2) difficulty = 0.6;
  else difficulty = 0.3;

  let resultMultiplier: number;
  if (outcome === "win") {
    resultMultiplier = setsLost === 0 ? 1.0 : 0.7;
  } else {
    resultMultiplier = setsWon === 0 ? -1.0 : -0.7;
  }

  const partnerDiff = partnerLevel - playerLevel;
  let partnerFactor = 1.0;
  if (partnerDiff >= 1.5 && outcome === "win") {
    partnerFactor = 0.8;
  } else if (partnerDiff <= -1.5 && outcome === "win") {
    partnerFactor = 1.2;
  }

  let ceilingFactor: number;
  if (playerLevel >= 7.0) ceilingFactor = 0.25;
  else if (playerLevel >= 6.0) ceilingFactor = 0.4;
  else if (playerLevel >= 5.0) ceilingFactor = 0.6;
  else if (playerLevel >= 4.0) ceilingFactor = 0.7;
  else if (playerLevel >= 3.0) ceilingFactor = 0.8;
  else if (playerLevel >= 2.0) ceilingFactor = 0.9;
  else ceilingFactor = 1.0;

  const appliedCeiling = resultMultiplier > 0 ? ceilingFactor : 1.0;

  const mult = params.deltaMultiplier != null && Number.isFinite(params.deltaMultiplier) ? params.deltaMultiplier : 1;
  const delta = k * difficulty * resultMultiplier * partnerFactor * appliedCeiling * mult;

  return Math.round(delta * 1000) / 1000;
}
