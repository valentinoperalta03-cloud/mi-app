import { isPowerOfTwo } from "./validation";

export type MatchInsert = {
  tournament_id: string;
  round: number;
  round_name: string;
  pair1_id?: string | null;
  pair2_id?: string | null;
  feeder_left_match_id?: string | null;
  feeder_right_match_id?: string | null;
  status: "pending";
};

function roundName(matchesInRound: number): string {
  if (matchesInRound >= 8) return "Octavos de final";
  if (matchesInRound === 4) return "Cuartos de final";
  if (matchesInRound === 2) return "Semifinal";
  if (matchesInRound === 1) return "Final";
  return `Ronda (${matchesInRound} partidos)`;
}

/** Todos contra todos — cada pareja juega contra todas las demas */
export function buildAmericanoMatches(tournamentId: string, pairIds: string[]): MatchInsert[] {
  const rows: MatchInsert[] = [];
  let round = 1;
  for (let i = 0; i < pairIds.length; i++) {
    for (let j = i + 1; j < pairIds.length; j++) {
      rows.push({
        tournament_id: tournamentId,
        round,
        round_name: `Todos contra todos · ${round}`,
        pair1_id: pairIds[i],
        pair2_id: pairIds[j],
        status: "pending",
      });
      round++;
    }
  }
  return rows;
}

/** Primera ronda de mixing (sorteo aleatorio) */
export function buildMixingRound1(tournamentId: string, pairIds: string[]): MatchInsert[] {
  const shuffled = [...pairIds].sort(() => Math.random() - 0.5);
  const rows: MatchInsert[] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    rows.push({
      tournament_id: tournamentId,
      round: 1,
      round_name: "Ronda 1 (sorteo)",
      pair1_id: shuffled[i],
      pair2_id: shuffled[i + 1],
      status: "pending",
    });
  }
  return rows;
}

/** Genera la siguiente ronda de mixing mezclando jugadores de parejas distintas.
 *  pairIds son los IDs de registration de los N ganadores de la ronda anterior;
 *  previousPairings es el set de "A:B" ya jugados para evitar repeticiones. */
export function buildMixingNextRound(
  tournamentId: string,
  round: number,
  pairIds: string[],
  previousPairings: Set<string>
): MatchInsert[] {
  const shuffled = [...pairIds].sort(() => Math.random() - 0.5);
  const rows: MatchInsert[] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    const key = [shuffled[i], shuffled[i + 1]].sort().join(":");
    if (previousPairings.has(key)) {
      // intento simple: swap con siguiente disponible
      const swapIdx = shuffled.findIndex((_, k) => k > i + 1 && !previousPairings.has([shuffled[i], shuffled[k]].sort().join(":")));
      if (swapIdx !== -1) {
        [shuffled[i + 1], shuffled[swapIdx]] = [shuffled[swapIdx], shuffled[i + 1]];
      }
    }
    rows.push({
      tournament_id: tournamentId,
      round,
      round_name: `Ronda ${round} (mixing)`,
      pair1_id: shuffled[i],
      pair2_id: shuffled[i + 1],
      status: "pending",
    });
  }
  return rows;
}

/**
 * Retorna la primera capa de partidos (con pair1_id / pair2_id) y las
 * capas de placeholders para rondas siguientes (con feeder_left/right_match_id).
 * La insercion en DB debe hacerse por capas en orden para obtener los IDs.
 */
export function buildEliminationFirstRound(
  tournamentId: string,
  pairIds: string[]
): MatchInsert[] {
  if (!isPowerOfTwo(pairIds.length)) {
    throw new Error("Eliminacion directa requiere potencia de 2");
  }
  const shuffled = [...pairIds].sort(() => Math.random() - 0.5);
  const rn = shuffled.length / 2;
  const rows: MatchInsert[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    rows.push({
      tournament_id: tournamentId,
      round: 1,
      round_name: roundName(rn),
      pair1_id: shuffled[i],
      pair2_id: shuffled[i + 1],
      status: "pending",
    });
  }
  return rows;
}

/** Genera la capa siguiente del bracket dado un array de IDs de partidos de la capa anterior */
export function buildEliminationNextLayer(
  tournamentId: string,
  round: number,
  feederIds: string[]
): MatchInsert[] {
  const rows: MatchInsert[] = [];
  for (let i = 0; i < feederIds.length; i += 2) {
    rows.push({
      tournament_id: tournamentId,
      round,
      round_name: roundName(feederIds.length / 2),
      feeder_left_match_id: feederIds[i],
      feeder_right_match_id: feederIds[i + 1],
      status: "pending",
    });
  }
  return rows;
}
