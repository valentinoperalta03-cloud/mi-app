/**
 * Helpers para evolucion competitiva basada en ELO.
 * Base de escala: `profiles.level` (1.0 a 5.0).
 */

export type MatchOutcome = "win" | "loss" | "draw";

/**
 * Probabilidad esperada de victoria (modelo ELO clasico).
 */
export function expectedScore(playerLevel: number, opponentLevel: number): number {
  return 1 / (1 + Math.pow(10, (opponentLevel - playerLevel) / 0.4));
}

/**
 * Delta sugerido para actualizar `profiles.level` tras un partido competitivo.
 * - Si ganas a alguien de mayor nivel, el delta sube automaticamente.
 */
export function computeEloDelta(params: {
  playerLevel: number;
  opponentLevel: number;
  outcome: MatchOutcome;
  kFactor?: number;
}): number {
  const { playerLevel, opponentLevel, outcome, kFactor = 0.08 } = params;
  const actual = outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0;
  const expected = expectedScore(playerLevel, opponentLevel);
  return (actual - expected) * kFactor;
}
