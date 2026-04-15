/**
 * Escala competitiva cerrada 0.0–7.0 (fuente de verdad: `profiles.technical_score`).
 * Bandas: 0–1 8va, 1–2 7ma, …, 6–7 2da/1ra.
 * Los cambios por partido viven en `lib/level-logic.ts`.
 */

export const TECH_SCORE_MIN = 0;
export const TECH_SCORE_MAX = 7;

export function clampTechnicalScore(value: number): number {
  if (!Number.isFinite(value)) return TECH_SCORE_MIN;
  return Math.min(TECH_SCORE_MAX, Math.max(TECH_SCORE_MIN, value));
}

/** Banda textual según tramos [0,1), [1,2), … [6,7]. */
export function bandFromTechnicalScore(score: number): string {
  const s = clampTechnicalScore(score);
  if (s < 1) return "8va";
  if (s < 2) return "7ma";
  if (s < 3) return "6ta";
  if (s < 4) return "5ta";
  if (s < 5) return "4ta";
  if (s < 6) return "3ra";
  return "2da/1ra";
}

/** Ej.: 4.2 → "4.2 - 4ta" (un decimal + banda). */
export function formatTechnicalLevelDisplay(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(Number(score))) return "—";
  const s = clampTechnicalScore(Number(score));
  return `${s.toFixed(1)} - ${bandFromTechnicalScore(s)}`;
}

/** Mapa cuestionario (~1–5) a escala 0–7 para primer nivelación. */
export function quizScoreToTechnicalScore(afterPenalty: number): number {
  const x = (afterPenalty - 1) / 4;
  return clampTechnicalScore(x * TECH_SCORE_MAX);
}
