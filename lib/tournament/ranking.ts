export type MatchForRanking = {
  id: string;
  pair1_id: string | null;
  pair2_id: string | null;
  pair1_score: number | null;
  pair2_score: number | null;
  status: string;
};

export type RankingRow = {
  pairId: string;
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  setDiff: number;
  points: number;
};

/**
 * Calcula el ranking americano a partir de partidos terminados.
 * Orden: puntos > diferencia de sets > sets a favor > head-to-head (simplificado).
 */
export function buildAmericanoRanking(matches: MatchForRanking[]): RankingRow[] {
  const map = new Map<string, RankingRow>();

  function getRow(pairId: string): RankingRow {
    if (!map.has(pairId)) {
      map.set(pairId, { pairId, played: 0, won: 0, lost: 0, setsFor: 0, setsAgainst: 0, setDiff: 0, points: 0 });
    }
    return map.get(pairId)!;
  }

  for (const m of matches) {
    if (m.status !== "finished" || !m.pair1_id || !m.pair2_id || m.pair1_score == null || m.pair2_score == null) continue;

    const r1 = getRow(m.pair1_id);
    const r2 = getRow(m.pair2_id);

    r1.played++;
    r2.played++;
    r1.setsFor += m.pair1_score;
    r1.setsAgainst += m.pair2_score;
    r2.setsFor += m.pair2_score;
    r2.setsAgainst += m.pair1_score;

    if (m.pair1_score > m.pair2_score) {
      r1.won++; r1.points += 2;
      r2.lost++;
    } else {
      r2.won++; r2.points += 2;
      r1.lost++;
    }
  }

  for (const row of map.values()) {
    row.setDiff = row.setsFor - row.setsAgainst;
  }

  return [...map.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
    return b.setsFor - a.setsFor;
  });
}
