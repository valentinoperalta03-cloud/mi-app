import type { CompetitionPhase, MatchFormat, MatchOutcome, SetsFormat } from "./types";

export type SetScoreInput = { p1: number; p2: number };

export type ResultInput =
  | { kind: "sets"; sets: SetScoreInput[] }
  | {
      kind: "timed";
      games1: number;
      games2: number;
      /** Solo eliminación con games iguales: quién ganó el desempate jugado en cancha. */
      tiebreakWinner?: 1 | 2 | null;
    };

export type ValidatedResult = {
  outcome: MatchOutcome;
  sets1: number;
  sets2: number;
  games1: number;
  games2: number;
  sets: SetScoreInput[];
  tiebreakWinner: 1 | 2 | null;
};

export type ResultValidation = { ok: true; result: ValidatedResult } | { ok: false; message: string };

/** Zonas y americano admiten empate (y solo en partidos por tiempo); eliminación no. */
export function phaseAllowsDraw(phase: CompetitionPhase): boolean {
  return phase === "zone" || phase === "americano";
}

function isNonNegativeInt(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 0;
}

/** Set normal: G-0..G-(G-2), (G+1)-(G-1) o (G+1)-G con tie-break. */
function isValidRegularSet(a: number, b: number, gamesPerSet: number): boolean {
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  if (w === gamesPerSet) return l <= gamesPerSet - 2;
  if (w === gamesPerSet + 1) return l === gamesPerSet - 1 || l === gamesPerSet;
  return false;
}

/** Super tie-break a 10 con diferencia de 2 (10-8, 11-9, 12-10…). */
function isValidSuperTiebreak(a: number, b: number): boolean {
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  if (w < 10) return false;
  return w === 10 ? l <= 8 : l === w - 2;
}

function fail(message: string): ResultValidation {
  return { ok: false, message };
}

function validateSets(format: SetsFormat, sets: SetScoreInput[]): ResultValidation {
  if (!Array.isArray(sets) || sets.length === 0) return fail("Cargá el resultado de los sets.");
  const needed = format.bestOf === 1 ? 1 : 2;
  const maxSets = format.bestOf;
  if (sets.length > maxSets) return fail(`El partido es a ${format.bestOf === 1 ? "1 set" : "mejor de 3 sets"}.`);

  let sets1 = 0;
  let sets2 = 0;
  let games1 = 0;
  let games2 = 0;

  for (let i = 0; i < sets.length; i++) {
    const { p1, p2 } = sets[i] ?? ({} as SetScoreInput);
    if (!isNonNegativeInt(p1) || !isNonNegativeInt(p2)) return fail(`Set ${i + 1}: los games tienen que ser números enteros.`);
    if (sets1 === needed || sets2 === needed) return fail("Hay sets cargados después de que el partido ya estaba definido.");

    const isDecider = format.bestOf === 3 && i === 2;
    if (isDecider && format.superTiebreakDecider) {
      if (!isValidSuperTiebreak(p1, p2)) return fail("El super tie-break tiene que terminar a 10 con 2 de diferencia.");
      // El super tie-break define el set (2-1) pero sus puntos no son games:
      // para diferencia/porcentaje de games solo cuentan los sets normales.
    } else {
      if (!isValidRegularSet(p1, p2, format.gamesPerSet)) return fail(`Set ${i + 1}: ${p1}-${p2} no es un resultado de set válido.`);
      games1 += p1;
      games2 += p2;
    }
    if (p1 > p2) sets1++;
    else sets2++;
  }

  if (sets1 !== needed && sets2 !== needed) return fail("El partido no está terminado: falta al menos un set.");

  return {
    ok: true,
    result: {
      outcome: sets1 > sets2 ? "pair1" : "pair2",
      sets1,
      sets2,
      games1,
      games2,
      sets: sets.map((s) => ({ p1: s.p1, p2: s.p2 })),
      tiebreakWinner: null,
    },
  };
}

/**
 * Valida un resultado contra el formato configurado y la fase. No acepta
 * scores imposibles, sets de más, ni empates fuera de la fase de zonas.
 * Si `declaredWinner` viene (ej. botón "ganó pareja 1"), tiene que coincidir.
 */
export function validateMatchResult(
  format: MatchFormat,
  phase: CompetitionPhase,
  input: ResultInput,
  declaredWinner?: 1 | 2 | null,
): ResultValidation {
  if (input.kind !== format.kind) {
    return fail(format.kind === "timed" ? "Este partido es por tiempo: cargá los games." : "Este partido es a sets: cargá cada set.");
  }

  let validation: ResultValidation;
  if (input.kind === "sets") {
    validation = validateSets(format as SetsFormat, input.sets);
  } else {
    const { games1, games2 } = input;
    const tb = input.tiebreakWinner ?? null;
    if (!isNonNegativeInt(games1) || !isNonNegativeInt(games2)) return fail("Los games tienen que ser números enteros.");
    let outcome: MatchOutcome;
    if (games1 !== games2) {
      if (tb !== null) return fail("Solo se carga desempate cuando los games quedan iguales.");
      outcome = games1 > games2 ? "pair1" : "pair2";
    } else if (phaseAllowsDraw(phase)) {
      if (tb !== null) return fail("En zonas el empate por tiempo es válido: no se carga desempate.");
      outcome = "draw";
    } else {
      if (tb !== 1 && tb !== 2) return fail("En eliminación no puede haber empate: indicá quién ganó el desempate.");
      outcome = tb === 1 ? "pair1" : "pair2";
    }
    validation = {
      ok: true,
      result: { outcome, sets1: 0, sets2: 0, games1, games2, sets: [], tiebreakWinner: games1 === games2 ? tb : null },
    };
  }

  if (!validation.ok) return validation;
  if (declaredWinner != null) {
    const expected = declaredWinner === 1 ? "pair1" : "pair2";
    if (validation.result.outcome !== expected) return fail("El ganador no coincide con el resultado cargado.");
  }
  return validation;
}

/** Minutos de cancha que ocupa un partido con este formato. */
export function slotMinutesForFormat(format: MatchFormat): number {
  return format.kind === "timed" ? format.minutes : format.slotMinutes;
}

export function validateMatchFormat(format: MatchFormat): { ok: true } | { ok: false; message: string } {
  if (format.kind === "timed") {
    if (!Number.isInteger(format.minutes) || format.minutes < 10 || format.minutes > 300) {
      return { ok: false, message: "La duración del partido tiene que estar entre 10 y 300 minutos." };
    }
    return { ok: true };
  }
  if (format.bestOf !== 1 && format.bestOf !== 3) return { ok: false, message: "Elegí 1 set o mejor de 3." };
  if (!Number.isInteger(format.gamesPerSet) || format.gamesPerSet < 1 || format.gamesPerSet > 9) {
    return { ok: false, message: "Games por set inválidos." };
  }
  if (!Number.isInteger(format.slotMinutes) || format.slotMinutes < 10 || format.slotMinutes > 300) {
    return { ok: false, message: "El tiempo de cancha reservado tiene que estar entre 10 y 300 minutos." };
  }
  return { ok: true };
}
