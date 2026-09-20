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

/**
 * Desempate absoluto ya resuelto (sección 25.2): `pairIds` es el grupo
 * empatado tal como lo reporta PendingTiebreak (sin orden), `order` es la
 * prioridad ya decidida — por partido de desempate jugado o por resolución
 * administrativa — de mejor a peor. No se inventa un orden: si `order` no
 * cubre exactamente `pairIds`, el empate sigue pendiente.
 */
export type ResolvedTiebreak = { pairIds: string[]; order: string[] };

function findResolution(pairIds: string[], resolved: ResolvedTiebreak[] | undefined): string[] | null {
  if (!resolved?.length) return null;
  const key = [...pairIds].sort().join(",");
  return resolved.find((r) => [...r.pairIds].sort().join(",") === key)?.order ?? null;
}

/** Reordena el tramo de `rows` ocupado por el grupo empatado según la resolución (mejor primero). */
function reorderRows(rows: StandingRow[], resolution: string[]): StandingRow[] {
  const indices = resolution.map((id) => rows.findIndex((r) => r.pairId === id));
  if (indices.some((i) => i < 0)) return rows;
  const slots = [...indices].sort((a, b) => a - b);
  const next = [...rows];
  slots.forEach((slot, i) => {
    next[slot] = rows[indices[i]];
  });
  return next;
}

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
 * admin lo resuelva — salvo que venga en `resolvedTies` (partido de
 * desempate jugado o resolución administrativa ya registrada), en cuyo caso
 * se aplica esa prioridad en vez de bloquear. Un empate exacto que solo
 * afecta el ORDEN de siembra entre parejas que ya clasifican las dos se
 * resuelve solo, por orden de zona (zona A antes que zona B, etc.) — no
 * bloquea la generación de la llave.
 */
export function selectQualifiers(zones: ZoneStandingsInput[], bracketSize: number, resolvedTies?: ResolvedTiebreak[]): QualifiersResult {
  const plan = qualificationPlan(
    zones.map((z) => z.standings.rows.length),
    bracketSize,
  );
  if (!plan.ok) return { ok: false, pending: [], message: plan.message };

  const deepest = plan.levels[plan.levels.length - 1].position;
  const pending: PendingTiebreak[] = [];

  // Empates DENTRO de una zona (zone_order): si están resueltos, se reordena
  // el tramo de `rows` correspondiente antes de armar los niveles de abajo.
  const effectiveZones: ZoneStandingsInput[] = zones.map((z) => {
    let rows = z.standings.rows;
    const stillUnresolved: string[][] = [];
    for (const group of z.standings.unresolvedTies) {
      const resolution = findResolution(group, resolvedTies);
      if (resolution) rows = reorderRows(rows, resolution);
      else stillUnresolved.push(group);
    }
    return { zoneId: z.zoneId, standings: { rows, unresolvedTies: stillUnresolved } };
  });

  effectiveZones.forEach((z) => {
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
    const candidates: Candidate[] = effectiveZones
      .map((z, zoneIndex) => ({ z, zoneIndex }))
      .filter(({ z }) => z.standings.rows.length >= level.position)
      .map(({ z, zoneIndex }) => ({
        row: z.standings.rows[level.position - 1],
        zoneId: z.zoneId,
        position: level.position,
        zoneIndex,
      }))
      .sort((a, b) => compareAcrossZones(a.row, b.row) || a.zoneIndex - b.zoneIndex);

    // Un empate exacto que cruza la frontera adentro/afuera bloquea, salvo
    // que ya esté resuelto (reordena `candidates` antes de recortar `taken`
    // más abajo). Un empate que queda enteramente adentro o afuera no
    // necesita resolución: ya quedó ordenado por zona.
    for (const run of tieRuns(candidates)) {
      if (run.length < 2) continue;
      const startIdx = candidates.indexOf(run[0]);
      const endIdx = startIdx + run.length - 1;
      if (!level.all && startIdx < level.takes && endIdx >= level.takes) {
        const resolution = findResolution(
          run.map((c) => c.row.pairId),
          resolvedTies,
        );
        const bySlot = resolution?.map((id) => run.find((c) => c.row.pairId === id)).filter((c): c is Candidate => Boolean(c));
        if (bySlot && bySlot.length === run.length) {
          for (let k = 0; k < run.length; k++) candidates[startIdx + k] = bySlot[k];
          continue;
        }
        pending.push({
          kind: "qualification",
          pairIds: run.map((c) => c.row.pairId),
          zoneId: null,
          position: level.position,
          message: `Empate exacto entre ${level.position}° de distintas zonas por un lugar en la llave.`,
        });
      }
    }

    const taken = candidates.slice(0, level.takes);
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
