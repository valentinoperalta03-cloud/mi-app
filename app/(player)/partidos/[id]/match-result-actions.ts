"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { classifyCategory } from "@/lib/level-quiz-logic";
import { computeEloDelta, eloKForExperience } from "@/lib/level-evolution-elo";
import { createNotification } from "@/lib/notifications";
import { validateBestOfThreeSets } from "@/lib/padel-set-score";
import { createClient } from "@/utils/supabase/server";

export type RecordMatchResultState = { ok: boolean; message: string };

const initialState: RecordMatchResultState = { ok: false, message: "" };
const LOCK_MINUTES = 30;
/** ELO por defecto (0–8) si falta dato en perfil. */
const DEFAULT_LEVEL = 3.0;

function parseScore(raw: FormDataEntryValue | null): number | null {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 0 || n > 30) return null;
  return n;
}

function nowIso() {
  return new Date().toISOString();
}

function isLockAlive(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() > Date.now();
}

function parseSetsJson(raw: FormDataEntryValue | null): { a: number; b: number }[] {
  const source = String(raw ?? "").trim();
  if (!source) return [];
  try {
    const parsed = JSON.parse(source) as Array<{ a: number; b: number }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) => ({ a: Number(s?.a ?? 0), b: Number(s?.b ?? 0) }))
      .filter((s) => Number.isFinite(s.a) && Number.isFinite(s.b) && s.a >= 0 && s.b >= 0)
      .slice(0, 3);
  } catch {
    return [];
  }
}

function parseAndValidateSets(raw: FormDataEntryValue | null):
  | { ok: true; sets: { a: number; b: number }[]; setsWonA: number; setsWonB: number }
  | { ok: false; message: string } {
  const parsed = parseSetsJson(raw);
  const v = validateBestOfThreeSets(parsed);
  if (!v.ok) return { ok: false, message: v.message ?? "Marcador de sets inválido." };
  return { ok: true, sets: parsed, setsWonA: v.setsWonA!, setsWonB: v.setsWonB! };
}

type ResultRow = {
  id: string;
  status: "pending_confirmation" | "confirmed" | "disputed" | null;
  team_a_score: number | null;
  team_b_score: number | null;
  elo_applied_at: string | null;
};

function setsWonLostFromStored(
  sets: unknown,
  teamASetsWon: number,
  teamBSetsWon: number
): { teamA: { won: number; lost: number }; teamB: { won: number; lost: number } } {
  if (Array.isArray(sets) && sets.length > 0) {
    let aWon = 0;
    let bWon = 0;
    for (const raw of sets as { a?: number; b?: number }[]) {
      const a = Number(raw?.a ?? 0);
      const b = Number(raw?.b ?? 0);
      if (a > b) aWon += 1;
      else if (b > a) bWon += 1;
    }
    return {
      teamA: { won: aWon, lost: bWon },
      teamB: { won: bWon, lost: aWon },
    };
  }
  return {
    teamA: { won: teamASetsWon, lost: teamBSetsWon },
    teamB: { won: teamBSetsWon, lost: teamASetsWon },
  };
}

function eloChangeNotificationBody(prev: number, next: number): { title: string; body: string } {
  const prevCat = classifyCategory(prev);
  const nextCat = classifyCategory(next);
  const d = next - prev;
  const deltaStr = `${d >= 0 ? "+" : ""}${d.toFixed(2)}`;
  if (prevCat !== nextCat && d > 0) {
    return { title: "Nivel actualizado", body: `🎉 ¡Subiste a ${nextCat}!` };
  }
  if (prevCat !== nextCat && d < 0) {
    return { title: "Nivel actualizado", body: `↓ Bajaste a ${nextCat}` };
  }
  if (d > 0) {
    return {
      title: "Nivel actualizado",
      body: `↑ ${deltaStr} → seguís en ${nextCat} (${next.toFixed(1)})`,
    };
  }
  if (d < 0) {
    return {
      title: "Nivel actualizado",
      body: `↓ ${deltaStr} → seguís en ${nextCat} (${next.toFixed(1)})`,
    };
  }
  return { title: "Nivel actualizado", body: `Tu nivel se mantuvo en ${nextCat} (${next.toFixed(1)})` };
}

async function applyEloForConfirmedMatch(params: {
  matchId: string;
  teamAIds: string[];
  teamBIds: string[];
  teamAScore: number;
  teamBScore: number;
}): Promise<RecordMatchResultState> {
  const { matchId, teamAIds, teamBIds, teamAScore, teamBScore } = params;
  const supabase = await createClient({ allowCookieWrites: true });

  const { data: already } = await supabase
    .from(DB_TABLES.matchResults)
    .select("elo_applied_at, sets")
    .eq("match_id", matchId)
    .maybeSingle();
  if ((already as { elo_applied_at?: string | null } | null)?.elo_applied_at) {
    return { ok: true, message: "Resultado confirmado." };
  }

  const setsStored = (already as { sets?: unknown } | null)?.sets;
  const { teamA: aSets, teamB: bSets } = setsWonLostFromStored(setsStored, teamAScore, teamBScore);

  const ids = [...teamAIds, ...teamBIds];
  const { data: profiles, error: pErr } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, level")
    .in("user_id", ids);
  if (pErr) return { ok: false, message: pErr.message };

  const levelById = new Map<string, number>();
  for (const p of (profiles ?? []) as { user_id: string; level?: number | null }[]) {
    levelById.set(
      p.user_id,
      p.level != null && Number.isFinite(Number(p.level)) ? Number(p.level) : DEFAULT_LEVEL
    );
  }
  for (const id of ids) if (!levelById.has(id)) levelById.set(id, DEFAULT_LEVEL);

  const { data: mpRows } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id, match_id")
    .in("player_id", ids);
  const matchIds = [...new Set((mpRows ?? []).map((r: { match_id: string }) => r.match_id))];
  const { data: matchMetaRows } =
    matchIds.length > 0
      ? await supabase
          .from(DB_TABLES.matches)
          .select("id, match_type, result_status")
          .in("id", matchIds)
      : { data: [] };
  const competitiveConfirmedIds = new Set(
    (matchMetaRows ?? [])
      .filter(
        (m: { match_type?: string | null; result_status?: string | null }) =>
          String(m.match_type ?? "").toLowerCase() === "competitivo" &&
          String(m.result_status ?? "").toLowerCase() === "confirmed"
      )
      .map((m: { id: string }) => m.id)
  );
  const countByPlayer = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const row of (mpRows ?? []) as { player_id: string; match_id: string }[]) {
    if (!competitiveConfirmedIds.has(row.match_id)) continue;
    countByPlayer.set(row.player_id, (countByPlayer.get(row.player_id) ?? 0) + 1);
  }

  const snapshot = new Map(levelById);
  const avgA = (snapshot.get(teamAIds[0]!)! + snapshot.get(teamAIds[1]!)!) / 2;
  const avgB = (snapshot.get(teamBIds[0]!)! + snapshot.get(teamBIds[1]!)!) / 2;
  const aWon = teamAScore > teamBScore;

  const partnerOf = (team: readonly [string, string], self: string) =>
    team[0] === self ? team[1]! : team[0]!;

  async function applyForPlayer(opts: {
    playerId: string;
    partnerId: string;
    opponentAvg: number;
    outcome: "win" | "loss";
    setsWon: number;
    setsLost: number;
  }) {
    const { playerId, partnerId, opponentAvg, outcome, setsWon, setsLost } = opts;
    const prev = snapshot.get(playerId) ?? DEFAULT_LEVEL;
    const partnerLevel = snapshot.get(partnerId) ?? DEFAULT_LEVEL;
    const totalMatchesPlayed = countByPlayer.get(playerId) ?? 0;
    const delta = computeEloDelta({
      playerLevel: prev,
      partnerLevel,
      opponentAvgLevel: opponentAvg,
      outcome,
      setsWon,
      setsLost,
      totalMatchesPlayed,
    });
    const next = Number(Math.max(0, Math.min(8, prev + delta)).toFixed(3));
    const kUsed = eloKForExperience(totalMatchesPlayed);

    const { error: upErr } = await supabase
      .from(DB_TABLES.profiles)
      .update({ level: next, level_of_play: classifyCategory(next), category: classifyCategory(next) })
      .eq("user_id", playerId);
    if (upErr) return { ok: false as const, message: upErr.message };

    const { error: evErr } = await supabase.from(DB_TABLES.levelEvolution).insert({
      user_id: playerId,
      score: next,
      category: classifyCategory(next),
      old_level: prev,
      new_level: next,
      source: "match_result",
      result: outcome,
      opponent_avg_level: opponentAvg,
      k_factor: kUsed,
      delta,
      previous_score: prev,
      new_score: next,
    });
    if (evErr) return { ok: false as const, message: evErr.message };

    const { title, body } = eloChangeNotificationBody(prev, next);
    await createNotification(supabase, {
      user_id: playerId,
      type: "level_up",
      title,
      body,
      match_id: matchId,
    });

    return { ok: true as const };
  }

  for (const playerId of teamAIds) {
    const partnerId = partnerOf([teamAIds[0]!, teamAIds[1]!], playerId);
    const outcome = aWon ? "win" : "loss";
    const res = await applyForPlayer({
      playerId,
      partnerId,
      opponentAvg: avgB,
      outcome,
      setsWon: aSets.won,
      setsLost: aSets.lost,
    });
    if (!res.ok) return res;
  }

  for (const playerId of teamBIds) {
    const partnerId = partnerOf([teamBIds[0]!, teamBIds[1]!], playerId);
    const outcome = aWon ? "loss" : "win";
    const res = await applyForPlayer({
      playerId,
      partnerId,
      opponentAvg: avgA,
      outcome,
      setsWon: bSets.won,
      setsLost: bSets.lost,
    });
    if (!res.ok) return res;
  }

  const { error: markErr } = await supabase
    .from(DB_TABLES.matchResults)
    .update({ elo_applied_at: nowIso() })
    .eq("match_id", matchId);
  if (markErr) return { ok: false, message: markErr.message };

  return { ok: true, message: "Resultado confirmado y ranking actualizado." };
}

async function finalizeFriendlyResult(matchId: string): Promise<RecordMatchResultState> {
  const supabase = await createClient({ allowCookieWrites: true });
  const { data: already } = await supabase
    .from(DB_TABLES.matchResults)
    .select("elo_applied_at")
    .eq("match_id", matchId)
    .maybeSingle();
  if ((already as { elo_applied_at?: string | null } | null)?.elo_applied_at) {
    return { ok: true, message: "Resultado confirmado." };
  }
  const { error: markErr } = await supabase
    .from(DB_TABLES.matchResults)
    .update({ elo_applied_at: nowIso() })
    .eq("match_id", matchId);
  if (markErr) return { ok: false, message: markErr.message };
  return { ok: true, message: "Resultado amistoso confirmado." };
}

export async function recordMatchResultAction(
  prevState: RecordMatchResultState = initialState,
  formData: FormData
): Promise<RecordMatchResultState> {
  void prevState;

  const intent = String(formData.get("intent") ?? "propose").trim();
  const matchId = String(formData.get("match_id") ?? "").trim();
  if (!matchId) return { ok: false, message: "Partido inválido." };

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return { ok: false, message: "Iniciá sesión para cargar el resultado." };
  }

  const { data: mp } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id, team")
    .eq("match_id", matchId);

  const rows = (mp ?? []) as { player_id: string; team: number | null }[];
  const ids = rows.map((r) => r.player_id);
  if (ids.length !== 4) {
    return { ok: false, message: "Este resultado requiere exactamente 4 jugadores." };
  }
  if (rows.some((r) => r.team !== 1 && r.team !== 2)) {
    return { ok: false, message: "Todos los jugadores deben tener equipo asignado." };
  }
  const teamAIds = rows.filter((r) => r.team === 1).map((r) => r.player_id);
  const teamBIds = rows.filter((r) => r.team === 2).map((r) => r.player_id);
  if (teamAIds.length !== 2 || teamBIds.length !== 2) {
    return { ok: false, message: "Cada equipo debe tener 2 jugadores." };
  }
  const userTeam = teamAIds.includes(user.id) ? "A" : teamBIds.includes(user.id) ? "B" : null;

  const { data: matchRow, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select(
      "owner_id, match_type, result_status, result_locked_by, result_locked_team, result_lock_expires_at"
    )
    .eq("id", matchId)
    .maybeSingle();
  if (mErr) return { ok: false, message: mErr.message };

  const matchMeta = (matchRow ?? null) as
    | {
        owner_id?: string | null;
        match_type?: string | null;
        result_status?: string | null;
        result_locked_by?: string | null;
        result_locked_team?: string | null;
        result_lock_expires_at?: string | null;
      }
    | null;
  const ownerId = matchMeta?.owner_id;
  const isCompetitive = String(matchMeta?.match_type ?? "").toLowerCase() === "competitivo";
  const allowed = ids.includes(user.id) || ownerId === user.id;
  if (!allowed) {
    return { ok: false, message: "No podés cargar el resultado de este partido." };
  }

  const { data: resultRow, error: rErr } = await supabase
    .from(DB_TABLES.matchResults)
    .select("id, status, team_a_score, team_b_score, elo_applied_at")
    .eq("match_id", matchId)
    .maybeSingle();
  if (rErr) return { ok: false, message: rErr.message };
  const existing = (resultRow ?? null) as ResultRow | null;

  if (intent === "start") {
    if (!userTeam) return { ok: false, message: "Solo jugadores pueden iniciar la carga." };
    const lockAlive = isLockAlive(matchMeta?.result_lock_expires_at);
    const sameTeamBlocked =
      lockAlive &&
      matchMeta?.result_locked_by &&
      matchMeta.result_locked_by !== user.id &&
      matchMeta?.result_locked_team === userTeam;

    if (sameTeamBlocked) {
      return { ok: false, message: "Tu pareja ya está cargando el resultado." };
    }

    const { error: lockErr } = await supabase
      .from(DB_TABLES.matches)
      .update({
        result_locked_by: user.id,
        result_locked_team: userTeam,
        result_lock_expires_at: new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString(),
      })
      .eq("id", matchId);
    if (lockErr) return { ok: false, message: lockErr.message };

    revalidatePath(`/partidos/${matchId}`);
    return { ok: true, message: "Carga iniciada. Ya podés ingresar el resultado." };
  }

  if (intent === "propose") {
    const setsRes = parseAndValidateSets(formData.get("sets_json"));
    if (!setsRes.ok) return { ok: false, message: setsRes.message };
    const teamA = setsRes.setsWonA;
    const teamB = setsRes.setsWonB;
    const sets = setsRes.sets;
    if (!userTeam) return { ok: false, message: "Solo un jugador del partido puede proponer." };

    const lockAlive = isLockAlive(matchMeta?.result_lock_expires_at);
    if (!lockAlive || matchMeta?.result_locked_by !== user.id) {
      return { ok: false, message: "Primero tocá 'Cargar Resultado' para tomar el control." };
    }

    const payload = {
      match_id: matchId,
      team_a_score: teamA,
      team_b_score: teamB,
      sets,
      proposed_by: user.id,
      status: "pending_confirmation",
      conflict_reason: null,
    };
    const { error: upErr } = await supabase.from(DB_TABLES.matchResults).upsert(payload);
    if (upErr) return { ok: false, message: upErr.message };

    const { data: nowRow } = await supabase
      .from(DB_TABLES.matchResults)
      .select("id")
      .eq("match_id", matchId)
      .maybeSingle();
    const resultId = (nowRow as { id?: string } | null)?.id;
    if (!resultId) return { ok: false, message: "No se pudo preparar la confirmación." };

    const { error: autoConfirmErr } = await supabase.from(DB_TABLES.matchResultConfirmations).upsert({
      match_result_id: resultId,
      user_id: user.id,
      decision: "confirm",
      team_a_score: teamA,
      team_b_score: teamB,
      updated_at: nowIso(),
    });
    if (autoConfirmErr) return { ok: false, message: autoConfirmErr.message };

    const { error: matchStatusErr } = await supabase
      .from(DB_TABLES.matches)
      .update({
        result_status: "pending_confirmation",
        result_locked_by: null,
        result_locked_team: null,
        result_lock_expires_at: null,
      })
      .eq("id", matchId);
    if (matchStatusErr) return { ok: false, message: matchStatusErr.message };

    const otherPlayerIds = ids.filter((id) => id !== user.id);
    await Promise.all(
      otherPlayerIds.map((playerId) =>
        createNotification(supabase, {
          user_id: playerId,
          type: "match_result",
          title: "Resultado pendiente",
          body: "Un compañero cargó el resultado del partido. Entrá a confirmarlo.",
          match_id: matchId,
        })
      )
    );

    revalidatePath(`/partidos/${matchId}`);
    revalidatePath("/home");
    return { ok: true, message: "Resultado enviado. Falta confirmación de los otros 3 jugadores." };
  }

  if (intent === "confirm" || intent === "dispute") {
    if (!existing) return { ok: false, message: "Todavía no hay resultado para validar." };
    if (!userTeam) return { ok: false, message: "Solo participantes pueden validar." };
    if (existing.status === "confirmed") return { ok: false, message: "Ya está confirmado." };

    const baseA = Number(existing.team_a_score ?? -1);
    const baseB = Number(existing.team_b_score ?? -1);
    if (baseA < 0 || baseB < 0) return { ok: false, message: "Resultado base inválido." };

    const enteredA = parseScore(formData.get("team_a_score"));
    const enteredB = parseScore(formData.get("team_b_score"));
    const mismatch =
      enteredA != null && enteredB != null && (enteredA !== baseA || enteredB !== baseB);
    const decision = intent === "dispute" || mismatch ? "dispute" : "confirm";

    const { error: confErr } = await supabase.from(DB_TABLES.matchResultConfirmations).upsert({
      match_result_id: existing.id,
      user_id: user.id,
      decision,
      team_a_score: enteredA ?? baseA,
      team_b_score: enteredB ?? baseB,
      updated_at: nowIso(),
    });
    if (confErr) return { ok: false, message: confErr.message };

    if (decision === "dispute") {
      await supabase
        .from(DB_TABLES.matchResults)
        .update({
          status: "pending_confirmation",
          conflict_reason: `Disputado por ${user.id} a las ${nowIso()}`,
          team_a_score: null,
          team_b_score: null,
          sets: null,
          proposed_by: null,
        })
        .eq("id", existing.id);

      await supabase
        .from(DB_TABLES.matchResultConfirmations)
        .delete()
        .eq("match_result_id", existing.id)
        .eq("user_id", user.id);

      await supabase
        .from(DB_TABLES.matches)
        .update({ result_status: "pending_confirmation" })
        .eq("id", matchId);

      const otherPlayerIds = ids.filter((id) => id !== user.id);
      await Promise.all(
        otherPlayerIds.map((pid) =>
          createNotification(supabase, {
            user_id: pid,
            type: "match_result",
            title: "Resultado disputado",
            body: "Un jugador no acordó con el marcador. Acordá el resultado con tus compañeros y volvé a proponer.",
            match_id: matchId,
          })
        )
      );

      revalidatePath(`/partidos/${matchId}`);
      revalidatePath("/home");
      return {
        ok: true,
        message: "Marcaste el resultado como incorrecto. Cualquier jugador puede proponer uno nuevo.",
      };
    }

    const { data: list, error: listErr } = await supabase
      .from(DB_TABLES.matchResultConfirmations)
      .select("user_id, decision, team_a_score, team_b_score")
      .eq("match_result_id", existing.id);
    if (listErr) return { ok: false, message: listErr.message };
    const confirmations = (list ??
      []) as { user_id: string; decision: string; team_a_score: number; team_b_score: number }[];

    const allConfirmed = ids.every((pid) =>
      confirmations.some(
        (c) =>
          c.user_id === pid &&
          c.decision === "confirm" &&
          Number(c.team_a_score) === baseA &&
          Number(c.team_b_score) === baseB
      )
    );

    if (!allConfirmed) {
      revalidatePath(`/partidos/${matchId}`);
      revalidatePath("/home");
      return { ok: true, message: "Confirmación registrada. Faltan respuestas del resto." };
    }

    await supabase.from(DB_TABLES.matchResults).update({ status: "confirmed" }).eq("id", existing.id);
    await supabase.from(DB_TABLES.matches).update({ result_status: "confirmed" }).eq("id", matchId);

    let eloRes: RecordMatchResultState;
    if (isCompetitive) {
      eloRes = await applyEloForConfirmedMatch({
        matchId,
        teamAIds,
        teamBIds,
        teamAScore: baseA,
        teamBScore: baseB,
      });
    } else {
      eloRes = await finalizeFriendlyResult(matchId);
    }
    if (!eloRes.ok) return eloRes;

    revalidatePath(`/partidos/${matchId}`);
    revalidatePath("/home");
    revalidatePath("/perfil");
    revalidatePath("/buscar-partido");
    return { ok: true, message: "Resultado confirmado por los 4 jugadores." };
  }

  return { ok: false, message: "Acción inválida." };
}

export async function autoConfirmExpiredResults(): Promise<void> {
  const supabase = await createClient({ allowCookieWrites: true });
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  const { data: oldResults } = await supabase
    .from(DB_TABLES.matchResults)
    .select("id, match_id, team_a_score, team_b_score, proposed_by")
    .eq("status", "pending_confirmation")
    .lt("updated_at", cutoff)
    .not("team_a_score", "is", null)
    .not("team_b_score", "is", null)
    .limit(50);

  if (!oldResults?.length) return;

  for (const result of oldResults as Array<{
    id: string;
    match_id: string;
    team_a_score: number;
    team_b_score: number;
    proposed_by: string | null;
  }>) {
    await supabase
      .from(DB_TABLES.matchResults)
      .update({ status: "confirmed" })
      .eq("id", result.id);

    await supabase
      .from(DB_TABLES.matches)
      .update({ result_status: "confirmed" })
      .eq("id", result.match_id);

    const { data: participants } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id, team")
      .eq("match_id", result.match_id);

    const rows = (participants ?? []) as { player_id: string; team: number }[];
    const teamAIds = rows.filter((r) => r.team === 1).map((r) => r.player_id);
    const teamBIds = rows.filter((r) => r.team === 2).map((r) => r.player_id);

    if (teamAIds.length === 2 && teamBIds.length === 2) {
      const { data: matchRow } = await supabase
        .from(DB_TABLES.matches)
        .select("match_type")
        .eq("id", result.match_id)
        .maybeSingle();

      const isCompetitive =
        String((matchRow as { match_type?: string } | null)?.match_type ?? "").toLowerCase() ===
        "competitivo";

      if (isCompetitive) {
        await applyEloForConfirmedMatch({
          matchId: result.match_id,
          teamAIds,
          teamBIds,
          teamAScore: result.team_a_score,
          teamBScore: result.team_b_score,
        });
      } else {
        await finalizeFriendlyResult(result.match_id);
      }

      const allIds = [...teamAIds, ...teamBIds];
      for (const playerId of allIds) {
        await createNotification(supabase, {
          user_id: playerId,
          type: "match_result",
          title: "Resultado confirmado automáticamente",
          body: "Pasaron 72hs sin respuesta de todos los jugadores. El resultado fue confirmado automáticamente.",
          match_id: result.match_id,
        });
      }
    }
  }
}
