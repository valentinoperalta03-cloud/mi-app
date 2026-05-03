"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { classifyCategory } from "@/lib/level-quiz-logic";
import { computeEloDelta } from "@/lib/level-evolution-elo";
import { createClient } from "@/utils/supabase/server";

export type RecordMatchResultState = { ok: boolean; message: string };

const initialState: RecordMatchResultState = { ok: false, message: "" };
const LOCK_MINUTES = 10;
const DEFAULT_LEVEL = 2.5;

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

function parseSets(raw: FormDataEntryValue | null): { a: number; b: number }[] {
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

type ResultRow = {
  id: string;
  status: "pending_confirmation" | "confirmed" | "disputed" | null;
  team_a_score: number | null;
  team_b_score: number | null;
  elo_applied_at: string | null;
};

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
    .select("elo_applied_at")
    .eq("match_id", matchId)
    .maybeSingle();
  if ((already as { elo_applied_at?: string | null } | null)?.elo_applied_at) {
    return { ok: true, message: "Resultado confirmado." };
  }

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

  const avgA = (levelById.get(teamAIds[0]!)! + levelById.get(teamAIds[1]!)!) / 2;
  const avgB = (levelById.get(teamBIds[0]!)! + levelById.get(teamBIds[1]!)!) / 2;
  const aWon = teamAScore > teamBScore;

  for (const playerId of teamAIds) {
    const prev = levelById.get(playerId) ?? DEFAULT_LEVEL;
    const outcome = aWon ? "win" : "loss";
    const delta = computeEloDelta({
      playerLevel: prev,
      opponentLevel: avgB,
      outcome,
    });
    const next = Number(Math.max(1, Math.min(5, prev + delta)).toFixed(3));

    const { error: upErr } = await supabase
      .from(DB_TABLES.profiles)
      .update({ level: next, level_of_play: classifyCategory(next) })
      .eq("user_id", playerId);
    if (upErr) return { ok: false, message: upErr.message };

    const { error: evErr } = await supabase.from(DB_TABLES.levelEvolution).insert({
      user_id: playerId,
      score: next,
      category: classifyCategory(next),
      old_level: prev,
      new_level: next,
      source: "match_result",
      result: outcome,
      opponent_avg_level: avgB,
      k_factor: 0.08,
      delta,
      previous_score: prev,
      new_score: next,
    });
    if (evErr) return { ok: false, message: evErr.message };
  }

  for (const playerId of teamBIds) {
    const prev = levelById.get(playerId) ?? DEFAULT_LEVEL;
    const outcome = aWon ? "loss" : "win";
    const delta = computeEloDelta({
      playerLevel: prev,
      opponentLevel: avgA,
      outcome,
    });
    const next = Number(Math.max(1, Math.min(5, prev + delta)).toFixed(3));

    const { error: upErr } = await supabase
      .from(DB_TABLES.profiles)
      .update({ level: next, level_of_play: classifyCategory(next) })
      .eq("user_id", playerId);
    if (upErr) return { ok: false, message: upErr.message };

    const { error: evErr } = await supabase.from(DB_TABLES.levelEvolution).insert({
      user_id: playerId,
      score: next,
      category: classifyCategory(next),
      old_level: prev,
      new_level: next,
      source: "match_result",
      result: outcome,
      opponent_avg_level: avgA,
      k_factor: 0.08,
      delta,
      previous_score: prev,
      new_score: next,
    });
    if (evErr) return { ok: false, message: evErr.message };
  }

  const { error: markErr } = await supabase
    .from(DB_TABLES.matchResults)
    .update({ elo_applied_at: nowIso() })
    .eq("match_id", matchId);
  if (markErr) return { ok: false, message: markErr.message };

  return { ok: true, message: "Resultado confirmado y ranking actualizado." };
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
    .select("player_id")
    .order("player_id", { ascending: true })
    .eq("match_id", matchId);

  const ids = (mp ?? []).map((r: { player_id: string }) => r.player_id);
  if (ids.length !== 4) {
    return { ok: false, message: "Este flujo competitivo requiere exactamente 4 jugadores." };
  }
  const teamAIds = [ids[0]!, ids[1]!];
  const teamBIds = [ids[2]!, ids[3]!];
  const userTeam = teamAIds.includes(user.id) ? "A" : teamBIds.includes(user.id) ? "B" : null;

  const { data: matchRow, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select("owner_id, match_type, result_status, result_locked_by, result_locked_team, result_lock_expires_at")
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
  if (!isCompetitive) {
    return { ok: false, message: "Este flujo de validación aplica solo a partidos competitivos." };
  }
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
    const teamA = parseScore(formData.get("team_a_score"));
    const teamB = parseScore(formData.get("team_b_score"));
    const sets = parseSets(formData.get("sets_json"));
    if (teamA == null || teamB == null) {
      return { ok: false, message: "Completá los sets con números válidos (0–30)." };
    }
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
        .update({ status: "disputed", conflict_reason: "Un jugador impugnó o cargó score distinto." })
        .eq("id", existing.id);
      await supabase.from(DB_TABLES.matches).update({ result_status: "disputed" }).eq("id", matchId);
      revalidatePath(`/partidos/${matchId}`);
      revalidatePath("/home");
      return { ok: true, message: "Resultado en disputa. No impacta ranking hasta resolver." };
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

    const eloRes = await applyEloForConfirmedMatch({
      matchId,
      teamAIds,
      teamBIds,
      teamAScore: baseA,
      teamBScore: baseB,
    });
    if (!eloRes.ok) return eloRes;

    revalidatePath(`/partidos/${matchId}`);
    revalidatePath("/home");
    revalidatePath("/perfil");
    revalidatePath("/buscar-partido");
    return { ok: true, message: "Resultado confirmado por los 4 jugadores." };
  }

  return { ok: false, message: "Acción inválida." };
}
