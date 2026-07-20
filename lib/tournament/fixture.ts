import { isPowerOfTwo } from "./validation";

export type TournamentMatchInsert = {
  id?: string;
  tournament_id: string;
  round: number;
  round_name: string;
  bracket?: "gold" | "silver";
  pair1_id?: string | null;
  pair2_id?: string | null;
  feeder_left_match_id?: string | null;
  feeder_right_match_id?: string | null;
  status: "pending";
};

// Alias para no romper las funciones existentes de abajo (americano/mixing), intactas.
type MatchInsert = TournamentMatchInsert;

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
 * Genera el fixture completo de eliminacion directa en un solo array, listo
 * para un unico insert en batch. Los IDs de cada partido se generan de
 * antemano (crypto.randomUUID) para poder encadenar feeder_left/right_match_id
 * de las rondas futuras sin necesidad de insertar capa por capa.
 *
 * Si consolationBracket = true, ademas de la llave principal (bracket: 'gold')
 * se genera una llave paralela (bracket: 'silver', "Copa de Plata") alimentada
 * por los perdedores de la ronda 1 de gold: cada partido de silver ronda 1
 * tiene como feeder_left/right_match_id los dos partidos de gold ronda 1 cuyo
 * perdedor cae ahi (propagateBracket decide "ganador" vs "perdedor" segun si
 * el partido hijo es del mismo bracket o de uno distinto al del padre).
 *
 * Los placeholders de rondas futuras se crean con pair1_id/pair2_id = null —
 * se completan automaticamente cuando propagateBracket corre al cargar cada
 * resultado.
 */
export function buildEliminationFixture(
  tournamentId: string,
  pairIds: string[],
  consolationBracket: boolean
): TournamentMatchInsert[] {
  if (!isPowerOfTwo(pairIds.length)) {
    throw new Error("Eliminacion directa requiere potencia de 2");
  }
  const rows: TournamentMatchInsert[] = [];
  const shuffled = [...pairIds].sort(() => Math.random() - 0.5);

  // ---- Llave de Oro: ronda 1 (con parejas ya sorteadas) ----
  const goldRound1: TournamentMatchInsert[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    goldRound1.push({
      id: crypto.randomUUID(),
      tournament_id: tournamentId,
      round: 1,
      round_name: roundName(shuffled.length / 2),
      bracket: "gold",
      pair1_id: shuffled[i],
      pair2_id: shuffled[i + 1],
      status: "pending",
    });
  }
  rows.push(...goldRound1);

  // ---- Llave de Oro: rondas siguientes (placeholders encadenados) ----
  let goldPrevLayer = goldRound1.map((m) => m.id!);
  let goldRound = 2;
  while (goldPrevLayer.length > 1) {
    const layer: TournamentMatchInsert[] = [];
    for (let i = 0; i < goldPrevLayer.length; i += 2) {
      layer.push({
        id: crypto.randomUUID(),
        tournament_id: tournamentId,
        round: goldRound,
        round_name: roundName(goldPrevLayer.length / 2),
        bracket: "gold",
        feeder_left_match_id: goldPrevLayer[i],
        feeder_right_match_id: goldPrevLayer[i + 1],
        status: "pending",
      });
    }
    rows.push(...layer);
    goldPrevLayer = layer.map((m) => m.id!);
    goldRound++;
  }

  // ---- Copa de Plata: alimentada por los perdedores de gold ronda 1 ----
  // Requiere al menos 2 partidos de gold ronda 1 (4 parejas) para tener con
  // quien emparejar a los perdedores.
  if (consolationBracket && goldRound1.length >= 2) {
    let silverPrevLayer = goldRound1.map((m) => m.id!); // "entrantes": los perdedores de estos partidos
    let silverRound = 1;
    while (silverPrevLayer.length > 1) {
      const layer: TournamentMatchInsert[] = [];
      for (let i = 0; i < silverPrevLayer.length; i += 2) {
        layer.push({
          id: crypto.randomUUID(),
          tournament_id: tournamentId,
          round: silverRound,
          round_name: `Copa de Plata · ${roundName(silverPrevLayer.length / 2)}`,
          bracket: "silver",
          feeder_left_match_id: silverPrevLayer[i],
          feeder_right_match_id: silverPrevLayer[i + 1],
          status: "pending",
        });
      }
      rows.push(...layer);
      silverPrevLayer = layer.map((m) => m.id!);
      silverRound++;
    }
  }

  return rows;
}
