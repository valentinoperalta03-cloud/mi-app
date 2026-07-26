import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { classifyCategory } from "@/lib/level-quiz-logic";
import { computeEloDelta, eloKForExperience } from "@/lib/level-evolution-elo";
import { createNotification } from "@/lib/notifications";

const DEFAULT_LEVEL = 3.0;

async function countFinishedTournamentMatchesForPlayer(
  admin: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: regs } = await admin
    .from(DB_TABLES.tournamentRegistrations)
    .select("id")
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);
  const regIds = ((regs ?? []) as { id: string }[]).map((r) => r.id);
  if (regIds.length === 0) return 0;
  const { data: rows } = await admin
    .from(DB_TABLES.tournamentMatches)
    .select("id, pair1_id, pair2_id")
    .eq("status", "finished")
    .or(
      regIds.length === 1
        ? `pair1_id.eq.${regIds[0]},pair2_id.eq.${regIds[0]}`
        : `pair1_id.in.(${regIds.join(",")}),pair2_id.in.(${regIds.join(",")})`
    );
  let n = 0;
  for (const m of (rows ?? []) as Array<{ pair1_id: string | null; pair2_id: string | null }>) {
    if (m.pair1_id && regIds.includes(m.pair1_id)) n += 1;
    else if (m.pair2_id && regIds.includes(m.pair2_id)) n += 1;
  }
  return n;
}

/**
 * Si `matchId` ya está `finished`, lo resetea a `pending` (limpia scores,
 * sets y winner_pair_id) y hace lo mismo recursivamente con los partidos que
 * lo tengan como feeder. Se usa antes de reasignar pair1_id/pair2_id de un
 * partido hijo: si ese hijo ya se jugó con la pareja vieja, su resultado y el
 * ELO que ya se aplicó quedan basados en un cruce que nunca existió, así que
 * hay que invalidarlo en cascada en vez de pisarle la pareja en silencio. El
 * ELO ya aplicado a ese partido no se revierte (limitación conocida:
 * level_evolution no guarda match_id), pero al menos el partido deja de
 * quedar con una pareja que no jugó ese resultado.
 */
async function resetMatchAndCascadeIfFinished(admin: SupabaseClient, matchId: string): Promise<void> {
  const { data: row } = await admin
    .from(DB_TABLES.tournamentMatches)
    .select("id, status")
    .eq("id", matchId)
    .maybeSingle();
  const m = row as { id?: string; status?: string } | null;
  if (!m?.id || m.status !== "finished") return;

  await admin
    .from(DB_TABLES.tournamentMatches)
    .update({ status: "pending", pair1_score: null, pair2_score: null, sets: null, winner_pair_id: null })
    .eq("id", matchId);

  const { data: children } = await admin
    .from(DB_TABLES.tournamentMatches)
    .select("id")
    .or(`feeder_left_match_id.eq.${matchId},feeder_right_match_id.eq.${matchId}`);
  for (const child of (children ?? []) as Array<{ id: string }>) {
    await resetMatchAndCascadeIfFinished(admin, child.id);
  }
}

/**
 * Propaga el resultado de un partido a los partidos que lo tienen como feeder.
 *
 * Regla general (vale para gold-only y para gold+silver por igual): si el
 * partido hijo es del MISMO bracket que el partido terminado, recibe al
 * GANADOR (avance normal de llave). Si el partido hijo es de un bracket
 * DISTINTO (solo pasa con partidos de gold ronda 1 que alimentan la ronda 1
 * de silver, la Copa de Plata), recibe al PERDEDOR. Un partido de ronda 2+
 * nunca tiene un hijo en un bracket distinto (buildEliminationFixture solo
 * crea ese cruce para gold ronda 1), asi que el perdedor de esas rondas
 * queda automaticamente eliminado sin ninguna accion extra.
 *
 * Al editar un resultado ya finalizado y cambiar el ganador, se vuelve a
 * llamar con el mismo finishedMatchId. Antes de reasignar la pareja que
 * avanza al partido hijo, si ese hijo ya estaba `finished` (jugado con la
 * pareja vieja) se resetea en cascada — ver `resetMatchAndCascadeIfFinished`
 * — para no dejar un partido jugado con una pareja que en realidad nunca
 * avanzó a esa instancia.
 */
export async function propagateBracket(admin: SupabaseClient, finishedMatchId: string, winnerPairId: string | null) {
  if (!winnerPairId) return;

  const { data: finishedRow } = await admin
    .from(DB_TABLES.tournamentMatches)
    .select("bracket, pair1_id, pair2_id")
    .eq("id", finishedMatchId)
    .maybeSingle();
  const finished = finishedRow as { bracket: string | null; pair1_id: string | null; pair2_id: string | null } | null;
  if (!finished) return;
  const finishedBracket = finished.bracket ?? "gold";
  const loserPairId = finished.pair1_id === winnerPairId ? finished.pair2_id : finished.pair1_id;

  const { data: children } = await admin
    .from(DB_TABLES.tournamentMatches)
    .select("id, bracket, feeder_left_match_id, feeder_right_match_id")
    .or(`feeder_left_match_id.eq.${finishedMatchId},feeder_right_match_id.eq.${finishedMatchId}`);
  for (const row of (children ?? []) as Array<{
    id: string;
    bracket: string | null;
    feeder_left_match_id: string | null;
    feeder_right_match_id: string | null;
  }>) {
    const sameBracket = (row.bracket ?? "gold") === finishedBracket;
    const advancingPairId = sameBracket ? winnerPairId : loserPairId;
    if (!advancingPairId) continue;

    // Si el hijo ya se jugó con la pareja vieja, invalidar en cascada antes
    // de pisarla — evita dejar un resultado/ELO aplicado sobre un cruce que
    // ya no existe.
    await resetMatchAndCascadeIfFinished(admin, row.id);

    if (row.feeder_left_match_id === finishedMatchId) {
      await admin.from(DB_TABLES.tournamentMatches).update({ pair1_id: advancingPairId }).eq("id", row.id);
    }
    if (row.feeder_right_match_id === finishedMatchId) {
      await admin.from(DB_TABLES.tournamentMatches).update({ pair2_id: advancingPairId }).eq("id", row.id);
    }
  }
}

type RegRow = {
  id: string;
  player1_id: string;
  player2_id: string | null;
};

function teamPlayers(reg: RegRow): string[] {
  return reg.player2_id ? [reg.player1_id, reg.player2_id] : [reg.player1_id];
}

function avgLevel(levelById: Map<string, number>, ids: string[]): number {
  const vals = ids.map((id) => levelById.get(id) ?? DEFAULT_LEVEL);
  return vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
}

export async function saveTournamentMatchResultAndElo(params: {
  admin: SupabaseClient;
  matchId: string;
  pair1Score: number;
  pair2Score: number;
  setsJson: unknown;
  tournamentName: string;
}): Promise<{ ok: boolean; message: string }> {
  const { admin, matchId, pair1Score, pair2Score, setsJson, tournamentName } = params;
  if (pair1Score === pair2Score) {
    return { ok: false, message: "Debe haber un ganador (marcadores distintos)." };
  }

  const { data: mrow, error: mErr } = await admin
    .from(DB_TABLES.tournamentMatches)
    .select("id, tournament_id, pair1_id, pair2_id, status")
    .eq("id", matchId)
    .maybeSingle();
  if (mErr || !mrow) return { ok: false, message: mErr?.message ?? "Partido no encontrado." };
  const m = mrow as {
    id: string;
    tournament_id: string;
    pair1_id: string | null;
    pair2_id: string | null;
    status: string;
  };
  if (m.status === "finished") {
    return { ok: false, message: "Este partido ya tiene resultado cargado." };
  }
  if (!m.pair1_id || !m.pair2_id) return { ok: false, message: "Faltan parejas en el partido." };

  const { data: regs } = await admin
    .from(DB_TABLES.tournamentRegistrations)
    .select("id, player1_id, player2_id")
    .in("id", [m.pair1_id, m.pair2_id]);
  const regList = (regs ?? []) as RegRow[];
  const regA = regList.find((r) => r.id === m.pair1_id);
  const regB = regList.find((r) => r.id === m.pair2_id);
  if (!regA || !regB) return { ok: false, message: "Inscripciones no encontradas." };

  const winnerPairId = pair1Score > pair2Score ? m.pair1_id : m.pair2_id;
  const winnerReg = pair1Score > pair2Score ? regA : regB;
  const loserReg = pair1Score > pair2Score ? regB : regA;

  const winnerSets = Math.max(pair1Score, pair2Score);
  const loserSets = Math.min(pair1Score, pair2Score);

  const playerIds = [...new Set([...teamPlayers(regA), ...teamPlayers(regB)])];
  const { data: profiles } = await admin.from(DB_TABLES.profiles).select("user_id, level").in("user_id", playerIds);
  const levelById = new Map<string, number>();
  for (const p of (profiles ?? []) as Array<{ user_id: string; level?: number | null }>) {
    levelById.set(
      p.user_id,
      p.level != null && Number.isFinite(Number(p.level)) ? Number(p.level) : DEFAULT_LEVEL
    );
  }
  for (const id of playerIds) if (!levelById.has(id)) levelById.set(id, DEFAULT_LEVEL);
  const snapshot = new Map(levelById);

  const avgWin = avgLevel(snapshot, teamPlayers(winnerReg));
  const avgLos = avgLevel(snapshot, teamPlayers(loserReg));

  async function applyPlayer(opts: {
    playerId: string;
    partnerId: string | null;
    opponentAvg: number;
    outcome: "win" | "loss";
    setsWon: number;
    setsLost: number;
  }) {
    const { playerId, partnerId, opponentAvg, outcome, setsWon, setsLost } = opts;
    const prev = snapshot.get(playerId) ?? DEFAULT_LEVEL;
    const partnerLevel = partnerId ? (snapshot.get(partnerId) ?? DEFAULT_LEVEL) : prev;
    const totalMatchesPlayed = await countFinishedTournamentMatchesForPlayer(admin, playerId);
    const delta = computeEloDelta({
      playerLevel: prev,
      partnerLevel,
      opponentAvgLevel: opponentAvg,
      outcome,
      setsWon,
      setsLost,
      totalMatchesPlayed,
      deltaMultiplier: 1.5,
    });
    const next = Number(Math.max(0, Math.min(8, prev + delta)).toFixed(3));
    const kUsed = eloKForExperience(totalMatchesPlayed);
    await admin
      .from(DB_TABLES.profiles)
      .update({
        level: next,
        level_of_play: classifyCategory(next),
        category: classifyCategory(next),
      })
      .eq("user_id", playerId);
    await admin.from(DB_TABLES.levelEvolution).insert({
      user_id: playerId,
      score: next,
      category: classifyCategory(next),
      old_level: prev,
      new_level: next,
      source: "tournament_match",
      result: outcome,
      opponent_avg_level: opponentAvg,
      k_factor: kUsed,
      delta,
      previous_score: prev,
      new_score: next,
    });
    const prevCat = classifyCategory(prev);
    const nextCat = classifyCategory(next);
    if (prevCat !== nextCat && delta > 0) {
      await createNotification(admin, {
        user_id: playerId,
        type: "tournament_event",
        title: "Torneo",
        body: `¡Pasaste de categoría! Ahora: ${nextCat} (${tournamentName}).`,
      });
    }
  }

  for (const pid of teamPlayers(winnerReg)) {
    const partner = teamPlayers(winnerReg).find((x) => x !== pid) ?? null;
    await applyPlayer({
      playerId: pid,
      partnerId: partner,
      opponentAvg: avgLos,
      outcome: "win",
      setsWon: winnerSets,
      setsLost: loserSets,
    });
  }
  for (const pid of teamPlayers(loserReg)) {
    const partner = teamPlayers(loserReg).find((x) => x !== pid) ?? null;
    await applyPlayer({
      playerId: pid,
      partnerId: partner,
      opponentAvg: avgWin,
      outcome: "loss",
      setsWon: loserSets,
      setsLost: winnerSets,
    });
  }

  await admin
    .from(DB_TABLES.tournamentMatches)
    .update({
      pair1_score: pair1Score,
      pair2_score: pair2Score,
      sets: setsJson as never,
      winner_pair_id: winnerPairId,
      status: "finished",
    })
    .eq("id", matchId);

  await propagateBracket(admin, matchId, winnerPairId);

  for (const pid of playerIds) {
    await createNotification(admin, {
      user_id: pid,
      type: "tournament_event",
      title: "Resultado en torneo",
      body: `Se cargó un resultado en ${tournamentName}.`,
    });
  }

  return { ok: true, message: "Resultado guardado." };
}
