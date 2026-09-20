import { qualificationPlan } from "./playoff";
import { compareAcrossZones, type StandingRow, type ZoneStandings } from "./standings";

export type ZoneStandingsInput = {
  zoneId: string;
  /** Debe ser la tabla final: el caller verifica que la zona terminó. */
  standings: ZoneStandings;
};

export type Qualifier = {
  seed: number;
  pairId: string;
  zoneId: string;
  position: number;
};

export type PendingTiebreak = {
  kind: "zone_order" | "qualification";
  pairIds: string[];
  zoneId: string | null;
  position: number | null;
  message: string;
};

export type QualifiersResult =
  | { ok: true; qualifiers: Qualifier[] }
  | { ok: false; pending: PendingTiebreak[]; message: string };

type Candidate = { row: StandingRow; zoneId: string; position: number; zoneIndex: number };

function tieRuns(sorted: Candidate[]): Candidate[][] {
  const runs: Candidate[][] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && compareAcrossZones(sorted[i].row, sorted[j].row) === 0) j++;
    runs.push(sorted.slice(i, j));
    i = j;
  }
  return runs;
}

/**
 * Elige y ordena (siembra) a los clasificados. Un empate exacto que define
 * quién clasifica (uno adentro, otro afuera) queda `pending` para que el
 * admin lo resuelva. Un empate exacto que solo afecta el ORDEN de siembra
 * entre parejas que ya clasifican las dos se resuelve solo, por orden de
 * zona (zona A antes que zona B, etc.) — no bloquea la generación de la llave.
 */
export function selectQualifiers(zones: ZoneStandingsInput[], bracketSize: number): QualifiersResult {
  const plan = qualificationPlan(
    zones.map((z) => z.standings.rows.length),
    bracketSize,
  );
  if (!plan.ok) return { ok: false, pending: [], message: plan.message };

  const deepest = plan.levels[plan.levels.length - 1].position;
  const pending: PendingTiebreak[] = [];

  zones.forEach((z) => {
    for (const group of z.standings.unresolvedTies) {
      const positions = group.map((id) => z.standings.rows.findIndex((r) => r.pairId === id) + 1);
      const best = Math.min(...positions);
      if (best <= deepest) {
        pending.push({
          kind: "zone_order",
          pairIds: group,
          zoneId: z.zoneId,
          position: best,
          message: `Empate exacto en la zona por el ${best}° puesto.`,
        });
      }
    }
  });

  const ordered: Candidate[] = [];
  for (const level of plan.levels) {
    const candidates: Candidate[] = zones
      .map((z, zoneIndex) => ({ z, zoneIndex }))
      .filter(({ z }) => z.standings.rows.length >= level.position)
      .map(({ z, zoneIndex }) => ({
        row: z.standings.rows[level.position - 1],
        zoneId: z.zoneId,
        position: level.position,
        zoneIndex,
      }))
      .sort((a, b) => compareAcrossZones(a.row, b.row) || a.zoneIndex - b.zoneIndex);

    const taken = candidates.slice(0, level.takes);
    // Un empate exacto que cruza la frontera adentro/afuera bloquea; un
    // empate exacto que queda enteramente adentro (o enteramente afuera) ya
    // se resolvió arriba por orden de zona (candidates viene ordenado así).
    for (const run of tieRuns(candidates)) {
      if (run.length < 2) continue;
      const startIdx = candidates.indexOf(run[0]);
      const endIdx = startIdx + run.length - 1;
      if (!level.all && startIdx < level.takes && endIdx >= level.takes) {
        pending.push({
          kind: "qualification",
          pairIds: run.map((c) => c.row.pairId),
          zoneId: null,
          position: level.position,
          message: `Empate exacto entre ${level.position}° de distintas zonas por un lugar en la llave.`,
        });
      }
    }
    ordered.push(...taken);
  }

  if (pending.length > 0) {
    return { ok: false, pending, message: "Hay desempates pendientes antes de generar la llave." };
  }

  return {
    ok: true,
    qualifiers: ordered.map((c, i) => ({ seed: i + 1, pairId: c.row.pairId, zoneId: c.zoneId, position: c.position })),
  };
}
