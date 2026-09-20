import type { ScoredMatch } from "./types";

export const POINTS_WIN = 2;
export const POINTS_DRAW = 1;
export const POINTS_LOSS = 0;

export type StandingRow = {
  pairId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
  setDiff: number;
  gameDiff: number;
};

export type ZoneStandings = {
  /** Ordenadas. Dentro de un empate exacto se conserva el orden de entrada. */
  rows: StandingRow[];
  /** Grupos de parejas empatadas en todos los criterios (no se desempata al azar). */
  unresolvedTies: string[][];
};

function emptyRow(pairId: string): StandingRow {
  return { pairId, played: 0, won: 0, drawn: 0, lost: 0, points: 0, setsFor: 0, setsAgainst: 0, gamesFor: 0, gamesAgainst: 0, setDiff: 0, gameDiff: 0 };
}

/** Criterio dentro de una zona: puntos, dif. de sets, dif. de games, games a favor. */
export function compareWithinZone(a: StandingRow, b: StandingRow): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
  if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
  return b.gamesFor - a.gamesFor;
}

/**
 * Tabla de un grupo (zona o americano completo). Solo usa partidos ya
 * validados (ScoredMatch); los pendientes no se pasan. Victoria 2, empate 1,
 * derrota 0.
 *
 * Dentro de una zona todas las parejas juegan la misma cantidad de partidos
 * (todos contra todos), así que el criterio normal (puntos/dif. de sets/dif.
 * de games/games a favor) alcanza. En el americano con garantizados una
 * pareja puede tener un partido más que otra (buildAmericanoPairings), así
 * que si los partidos jugados no son parejos se usa el criterio normalizado
 * (mismo que entre zonas de distinto tamaño) para no premiar a quien jugó
 * más. `forceNormalized` fuerza ese criterio aunque hoy estén parejos (se
 * usa mientras el americano todavía tiene partidos pendientes).
 */
export function computeZoneStandings(
  pairIds: string[],
  matches: ScoredMatch[],
  options?: { forceNormalized?: boolean },
): ZoneStandings {
  const map = new Map<string, StandingRow>();
  for (const id of pairIds) map.set(id, emptyRow(id));

  for (const m of matches) {
    const r1 = map.get(m.pair1Id);
    const r2 = map.get(m.pair2Id);
    if (!r1 || !r2) continue;
    r1.played++;
    r2.played++;
    r1.setsFor += m.sets1;
    r1.setsAgainst += m.sets2;
    r2.setsFor += m.sets2;
    r2.setsAgainst += m.sets1;
    r1.gamesFor += m.games1;
    r1.gamesAgainst += m.games2;
    r2.gamesFor += m.games2;
    r2.gamesAgainst += m.games1;
    if (m.outcome === "draw") {
      r1.drawn++;
      r2.drawn++;
      r1.points += POINTS_DRAW;
      r2.points += POINTS_DRAW;
    } else if (m.outcome === "pair1") {
      r1.won++;
      r2.lost++;
      r1.points += POINTS_WIN;
      r2.points += POINTS_LOSS;
    } else {
      r2.won++;
      r1.lost++;
      r2.points += POINTS_WIN;
      r1.points += POINTS_LOSS;
    }
  }

  const rows = [...map.values()];
  for (const r of rows) {
    r.setDiff = r.setsFor - r.setsAgainst;
    r.gameDiff = r.gamesFor - r.gamesAgainst;
  }
  const uneven = new Set(rows.map((r) => r.played)).size > 1;
  const normalized = options?.forceNormalized || uneven;
  const compare = normalized ? compareAcrossZones : compareWithinZone;

  const indexed = rows.map((row, i) => ({ row, i }));
  indexed.sort((a, b) => compare(a.row, b.row) || a.i - b.i);
  const sorted = indexed.map((x) => x.row);

  return { rows: sorted, unresolvedTies: tieGroups(sorted, (a, b) => compare(a, b) === 0) };
}

/** Tabla del americano completo (no por zona): mismo motor, con normalización automática si alguien jugó de más. */
export function computeAmericanoStandings(pairIds: string[], matches: ScoredMatch[], allMatchesFinished: boolean): ZoneStandings {
  return computeZoneStandings(pairIds, matches, { forceNormalized: !allMatchesFinished });
}

function tieGroups<T extends { pairId: string }>(sorted: T[], equal: (a: T, b: T) => boolean): string[][] {
  const groups: string[][] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && equal(sorted[i], sorted[j])) j++;
    if (j - i > 1) groups.push(sorted.slice(i, j).map((r) => r.pairId));
    i = j;
  }
  return groups;
}

/** Fracción exacta (sin floats) para comparar porcentajes entre zonas. */
type Fraction = { num: number; den: number } | null;

function frac(num: number, den: number): Fraction {
  return den > 0 ? { num, den } : null;
}

/** >0 si a es mayor. null si el criterio no aplica a alguno (ej. partidos por tiempo no tienen sets). */
function compareFractions(a: Fraction, b: Fraction): number | null {
  if (!a || !b) return null;
  return a.num * b.den - b.num * a.den;
}

export type NormalizedStats = {
  pointsPct: Fraction;
  setsPct: Fraction;
  gamesPct: Fraction;
  gameDiffPerMatch: Fraction;
};

export function normalizedStats(row: StandingRow): NormalizedStats {
  return {
    pointsPct: frac(row.points, row.played * POINTS_WIN),
    setsPct: frac(row.setsFor, row.setsFor + row.setsAgainst),
    gamesPct: frac(row.gamesFor, row.gamesFor + row.gamesAgainst),
    gameDiffPerMatch: frac(row.gameDiff, row.played),
  };
}

/**
 * Comparación entre zonas de distinto tamaño (mejores 2°, 3°…): % de puntos,
 * % de sets, % de games, diferencia de games por partido. Negativo si `a` va
 * antes. 0 = empate exacto: no se elige al azar.
 */
export function compareAcrossZones(a: StandingRow, b: StandingRow): number {
  const na = normalizedStats(a);
  const nb = normalizedStats(b);
  const criteria: Array<keyof NormalizedStats> = ["pointsPct", "setsPct", "gamesPct", "gameDiffPerMatch"];
  for (const key of criteria) {
    const c = compareFractions(na[key], nb[key]);
    if (c !== null && c !== 0) return -Math.sign(c);
  }
  return 0;
}
