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

// Alias para no romper las funciones existentes de abajo (americano/eliminacion), intactas.
type MatchInsert = TournamentMatchInsert;

/** Una inscripción individual de peña: una fila de tournament_registrations con un solo jugador. */
export type PenaPlayerSlot = { registrationId: string; playerId: string };

/** Pareja sorteada al azar entre dos inscripciones individuales de peña. */
export type PenaPairMerge = {
  /** Inscripción que se conserva: se le asigna player2_id = mergePlayerId. */
  keepRegistrationId: string;
  mergePlayerId: string;
  /** Inscripción del segundo jugador de la pareja, que queda redundante y se borra. */
  removeRegistrationId: string;
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

/**
 * Arma la primera (y única) ronda de una peña: sortea a los jugadores
 * inscriptos individualmente y los agrupa de a 2 para formar parejas, luego
 * enfrenta pareja 1 vs pareja 2, pareja 3 vs pareja 4, etc. La app no genera
 * rondas siguientes — la peña es un evento social de una sola ronda.
 *
 * Como la inscripción de peña es individual (1 fila de tournament_registrations
 * = 1 jugador) pero tournament_matches.pair1_id/pair2_id apuntan a UNA sola
 * fila de tournament_registrations, cada pareja sorteada se materializa
 * fusionando las dos inscripciones individuales en una sola fila (se
 * devuelve en `merges`; el caller debe aplicar esos merges — UPDATE
 * player2_id en `keepRegistrationId` + DELETE de `removeRegistrationId` —
 * antes de insertar `matches`, ya que `matches` referencia los
 * `keepRegistrationId` resultantes). Si la cantidad de parejas es impar,
 * la última pareja queda sin rival (bye) y no genera partido.
 */
export function buildPenaFirstRound(
  tournamentId: string,
  slots: PenaPlayerSlot[]
): { matches: TournamentMatchInsert[]; merges: PenaPairMerge[] } {
  const shuffled = [...slots].sort(() => Math.random() - 0.5);

  const merges: PenaPairMerge[] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    merges.push({
      keepRegistrationId: shuffled[i].registrationId,
      mergePlayerId: shuffled[i + 1].playerId,
      removeRegistrationId: shuffled[i + 1].registrationId,
    });
  }

  const matches: TournamentMatchInsert[] = [];
  for (let i = 0; i + 1 < merges.length; i += 2) {
    matches.push({
      tournament_id: tournamentId,
      round: 1,
      round_name: "Ronda 1 (sorteo)",
      pair1_id: merges[i].keepRegistrationId,
      pair2_id: merges[i + 1].keepRegistrationId,
      status: "pending",
    });
  }

  return { matches, merges };
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
