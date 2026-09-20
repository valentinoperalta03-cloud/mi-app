/**
 * Tipos del motor de Torneos V2. Todo lo que vive en lib/tournament/v2 es
 * lógica pura (sin Supabase, sin Next) para poder testearla con node --test.
 */

export type Modality = "caballeros" | "damas" | "mixto";

export type CategoryRule =
  | { kind: "open"; modality: Modality | null }
  | { kind: "traditional"; modality: Modality | null; levels: number[] }
  | { kind: "suma"; modality: Modality | null; sumaTarget: number };

/** Nivel 1..8 ("1ra".."8va") y género tal como viven en profiles. */
export type PlayerProfileForCategory = {
  level: number | null;
  gender: string | null;
};

export type TimedFormat = { kind: "timed"; minutes: number };

export type SetsFormat = {
  kind: "sets";
  bestOf: 1 | 3;
  /** Games para ganar un set (6 en el formato habitual). */
  gamesPerSet: number;
  /** Si el set decisivo de un mejor de 3 se juega como super tie-break. */
  superTiebreakDecider: boolean;
  /** Tiempo de cancha reservado por partido; no se deduce del formato. */
  slotMinutes: number;
};

export type MatchFormat = TimedFormat | SetsFormat;

/**
 * Método de desempate cuando un partido por tiempo termina en eliminación
 * (empate no permitido ahí). Único método hoy: punto decisivo ("punto de
 * oro"), jugado en cancha y cargado por el club. El tipo queda como unión
 * para poder sumar otros métodos después sin tocar los llamadores.
 */
export type KnockoutTiebreakMethod = "golden_point";
export const DEFAULT_KNOCKOUT_TIEBREAK_METHOD: KnockoutTiebreakMethod = "golden_point";

/** Formato por defecto + overrides opcionales por fase. */
export type TournamentFormats = {
  default: MatchFormat;
  zone?: MatchFormat;
  knockout?: MatchFormat;
  final?: MatchFormat;
};

/** Fase competitiva de un partido. Zonas y americano admiten empate por tiempo; knockout y pena no. */
export type CompetitionPhase = "zone" | "americano" | "knockout" | "pena";

/** Defaults del formato de sets (sección 6 de las decisiones de producto): configurable, no hardcodeado en la lógica. */
export function defaultSetsFormat(bestOf: 1 | 3, slotMinutes: number): SetsFormat {
  return { kind: "sets", bestOf, gamesPerSet: 6, superTiebreakDecider: bestOf === 3, slotMinutes };
}

export type MatchOutcome = "pair1" | "pair2" | "draw";

/** Resultado ya validado y normalizado, listo para tablas y llaves. */
export type ScoredMatch = {
  pair1Id: string;
  pair2Id: string;
  sets1: number;
  sets2: number;
  games1: number;
  games2: number;
  outcome: MatchOutcome;
};
