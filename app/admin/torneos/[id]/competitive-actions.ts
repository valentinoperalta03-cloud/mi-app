"use server";

import { revalidatePath } from "next/cache";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { propagateBracket } from "@/lib/tournament-match-result";
import { buildSeededEliminationFixture, type SeededEntry } from "@/lib/tournament/v2/bracket";
import { pickMatchFormat, resolveTournamentFormats, type MatchPhaseForFormat } from "@/lib/tournament/v2/match-format";
import { qualificationPlan } from "@/lib/tournament/v2/playoff";
import { selectQualifiers, type ZoneStandingsInput } from "@/lib/tournament/v2/qualifiers";
import { validateMatchResult, type ResultInput } from "@/lib/tournament/v2/results";
import { computeZoneStandings } from "@/lib/tournament/v2/standings";
import type { CompetitionPhase, ScoredMatch } from "@/lib/tournament/v2/types";
import { createClient, createServiceClient } from "@/utils/supabase/server";

type ActionResult = { ok: boolean; message: string };

function firstRow<T>(data: T[] | T | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

async function assertCategoryOwner(tournamentId: string, categoryId: string) {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false as const, message: "Sesión requerida." };
  const { data: cat } = await supabase
    .from(DB_TABLES.tournamentCategories)
    .select("id, tournament_id")
    .eq("id", categoryId)
    .maybeSingle();
  const catRow = cat as { id: string; tournament_id: string } | null;
  if (!catRow || catRow.tournament_id !== tournamentId) return { ok: false as const, message: "Categoría no encontrada." };
  const { data: t } = await supabase.from(DB_TABLES.tournaments).select("club_id, is_individual").eq("id", tournamentId).maybeSingle();
  const tRow = t as { club_id: string; is_individual: boolean | null } | null;
  if (!tRow || !ctx.clubIds.includes(tRow.club_id)) return { ok: false as const, message: "No autorizado." };
  return { ok: true as const, isIndividual: Boolean(tRow.is_individual) };
}

const ZONE_MATCHES_REASON_MESSAGES: Record<string, string> = {
  category_not_found: "Categoría no encontrada.",
  forbidden: "No autorizado.",
  no_zones: "Generá las zonas antes de armar los partidos.",
  zone_matches_started: "Ya hay resultados de zona cargados: no se puede rehacer la lista de partidos.",
};

/** Genera (o regenera, si nadie jugó todavía) los partidos round-robin de cada zona de la categoría. */
export async function generateZoneMatchesAction(tournamentId: string, categoryId: string): Promise<ActionResult & { matchesCreated?: number }> {
  const gate = await assertCategoryOwner(tournamentId, categoryId);
  if (!gate.ok) return gate;
  const supabase = await createClient({ allowCookieWrites: true });
  const { data, error } = await supabase.rpc("tournament_generate_zone_matches", { p_category_id: categoryId });
  if (error) return { ok: false, message: "No se pudieron generar los partidos de zona." };
  const res = firstRow(data) as { ok: boolean; reason: string; matches_created: number } | null;
  if (!res?.ok) return { ok: false, message: ZONE_MATCHES_REASON_MESSAGES[res?.reason ?? ""] ?? "No se pudo generar." };
  revalidatePath(`/admin/torneos/${tournamentId}`);
  return { ok: true, message: `${res.matches_created} partidos generados.`, matchesCreated: res.matches_created };
}

const RESULT_REASON_MESSAGES: Record<string, string> = {
  match_not_found: "Partido no encontrado.",
  forbidden: "No autorizado.",
  missing_pairs: "Faltan parejas en el partido.",
  invalid_outcome: "Resultado inválido.",
  qualifiers_already_generated:
    "Ya se generaron los clasificados de esta categoría: corregir este resultado podría cambiar quién clasificó. Da de baja los clasificados antes de corregirlo.",
  next_round_started: "La pareja que ganó este partido ya jugó (o empezó) la siguiente ronda: no se puede corregir el resultado.",
  draw_not_allowed: "En esta fase no puede haber empate.",
};

/** Mapeo de la fase persistida en tournament_matches al CompetitionPhase que usa validateMatchResult. */
function competitionPhaseFor(phase: string): CompetitionPhase {
  if (phase === "zone") return "zone";
  if (phase === "americano") return "americano";
  // americano_final (final/3er puesto) y knockout se deciden sin empate, igual que knockout.
  return "knockout";
}

/**
 * Carga o corrige el resultado de un partido de zona o de cuadro. Reutiliza
 * validateMatchResult (Fase A) para la validación deportiva y
 * tournament_apply_match_result_v2 para la persistencia + los bloqueos de
 * edición retroactiva; si el ganador cambia y el partido es de cuadro,
 * reutiliza propagateBracket (ya existente) para el avance automático.
 */
export async function saveMatchResultAction(
  tournamentId: string,
  matchId: string,
  input: ResultInput,
  declaredWinner?: 1 | 2 | null,
): Promise<ActionResult> {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, message: "Sesión requerida." };

  const service = createServiceClient();
  const { data: matchRow } = await service
    .from(DB_TABLES.tournamentMatches)
    .select("id, category_id, zone_id, phase, round")
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!matchRow) return { ok: false, message: "Partido no encontrado." };
  const match = matchRow as { id: string; category_id: string | null; zone_id: string | null; phase: string | null; round: number };

  const { data: tRow } = await service.from(DB_TABLES.tournaments).select("club_id, match_formats").eq("id", tournamentId).maybeSingle();
  const tour = tRow as { club_id: string; match_formats: unknown } | null;
  if (!tour || !ctx.clubIds.includes(tour.club_id)) return { ok: false, message: "No autorizado." };

  const dbPhase = match.phase ?? "knockout";
  let isFinal = false;
  if (dbPhase === "knockout" && match.category_id) {
    const { data: maxRow } = await service
      .from(DB_TABLES.tournamentMatches)
      .select("round")
      .eq("category_id", match.category_id)
      .eq("phase", "knockout")
      .order("round", { ascending: false })
      .limit(1)
      .maybeSingle();
    isFinal = (maxRow as { round?: number } | null)?.round === match.round;
  }

  const formats = resolveTournamentFormats(tour.match_formats);
  const format = pickMatchFormat(formats, dbPhase as MatchPhaseForFormat, isFinal);
  const validation = validateMatchResult(format, competitionPhaseFor(dbPhase), input, declaredWinner);
  if (!validation.ok) return { ok: false, message: validation.message };
  const result = validation.result;

  const { data: rpcRows, error: rpcErr } = await supabase.rpc("tournament_apply_match_result_v2", {
    p_match_id: matchId,
    p_outcome: result.outcome,
    p_sets1: result.sets1,
    p_sets2: result.sets2,
    p_games1: result.games1,
    p_games2: result.games2,
    p_sets_json: result.sets,
    p_tiebreak_winner: result.tiebreakWinner,
  });
  if (rpcErr) return { ok: false, message: "No se pudo guardar el resultado." };
  const res = firstRow(rpcRows) as { ok: boolean; reason: string; winner_pair_id: string | null; phase: string | null } | null;
  if (!res?.ok) return { ok: false, message: RESULT_REASON_MESSAGES[res?.reason ?? ""] ?? "No se pudo guardar el resultado." };

  if (res.phase === "knockout" && res.winner_pair_id) {
    await propagateBracket(service, matchId, res.winner_pair_id);
  }

  revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath(`/torneos/${tournamentId}`);
  return { ok: true, message: "Resultado guardado." };
}

export type QualifiersPreview =
  | { ok: true; qualifiers: Array<{ seed: number; pairId: string; zoneId: string; position: number }> }
  | { ok: false; pending: Array<{ kind: string; pairIds: string[]; message: string }>; message: string }
  | { ok: false; message: string; pending?: undefined };

/**
 * Calcula (sin persistir) los clasificados de una categoría a partir de los
 * standings de zona ya jugados. Usa selectQualifiers (Fase A) — si hay un
 * empate exacto que cruza la frontera de clasificación, lo devuelve como
 * `pending` para que el admin lo resuelva; nunca elige arbitrariamente.
 */
export async function previewQualifiersAction(tournamentId: string, categoryId: string, bracketSize: number): Promise<QualifiersPreview> {
  const gate = await assertCategoryOwner(tournamentId, categoryId);
  if (!gate.ok) return gate;
  const service = createServiceClient();

  const { data: zones } = await service
    .from(DB_TABLES.tournamentZones)
    .select("id, name")
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: true });
  const zoneList = (zones ?? []) as Array<{ id: string; name: string }>;
  if (zoneList.length === 0) return { ok: false, message: "Esta categoría no tiene zonas." };

  const { data: matches } = await service
    .from(DB_TABLES.tournamentMatches)
    .select("zone_id, pair1_id, pair2_id, pair1_score, pair2_score, pair1_games, pair2_games, is_draw, status")
    .eq("category_id", categoryId)
    .eq("phase", "zone");
  const matchList = (matches ?? []) as Array<{
    zone_id: string | null;
    pair1_id: string | null;
    pair2_id: string | null;
    pair1_score: number | null;
    pair2_score: number | null;
    pair1_games: number | null;
    pair2_games: number | null;
    is_draw: boolean | null;
    status: string;
  }>;
  if (matchList.length === 0) return { ok: false, message: "Generá y jugá los partidos de zona primero." };
  if (matchList.some((m) => m.status !== "finished")) return { ok: false, message: "Todavía hay partidos de zona sin resultado." };

  const { data: regs } = await service.from(DB_TABLES.tournamentRegistrations).select("id, zone_id").eq("category_id", categoryId);
  const regList = (regs ?? []) as Array<{ id: string; zone_id: string | null }>;

  const zonesInput: ZoneStandingsInput[] = zoneList.map((z) => {
    const memberIds = regList.filter((r) => r.zone_id === z.id).map((r) => r.id);
    const scored: ScoredMatch[] = matchList
      .filter((m) => m.zone_id === z.id && m.pair1_id && m.pair2_id)
      .map((m) => ({
        pair1Id: m.pair1_id!,
        pair2Id: m.pair2_id!,
        sets1: m.pair1_score ?? 0,
        sets2: m.pair2_score ?? 0,
        games1: m.pair1_games ?? 0,
        games2: m.pair2_games ?? 0,
        outcome: m.is_draw ? "draw" : (m.pair1_score ?? 0) > (m.pair2_score ?? 0) ? "pair1" : "pair2",
      }));
    return { zoneId: z.id, standings: computeZoneStandings(memberIds, scored) };
  });

  const plan = qualificationPlan(
    zonesInput.map((z) => z.standings.rows.length),
    bracketSize,
  );
  if (!plan.ok) return { ok: false, message: plan.message };

  const result = selectQualifiers(zonesInput, bracketSize);
  if (!result.ok) {
    return { ok: false, pending: result.pending, message: result.message };
  }
  return { ok: true, qualifiers: result.qualifiers };
}

/** Persiste los clasificados ya calculados (sin empates pendientes) — habilita generar el cuadro. */
export async function generateQualifiersAction(
  tournamentId: string,
  categoryId: string,
  bracketSize: number,
): Promise<ActionResult> {
  const preview = await previewQualifiersAction(tournamentId, categoryId, bracketSize);
  if (!preview.ok) {
    return { ok: false, message: "pending" in preview && preview.pending?.length ? "Hay un empate exacto pendiente de resolver: " + preview.pending[0].message : preview.message };
  }
  const supabase = await createClient({ allowCookieWrites: true });
  const seeds = preview.qualifiers.map((q) => ({ registrationId: q.pairId, seed: q.seed }));
  const { data, error } = await supabase.rpc("tournament_set_qualifiers", { p_category_id: categoryId, p_seeds: seeds });
  if (error) return { ok: false, message: "No se pudieron guardar los clasificados." };
  const res = firstRow(data) as { ok: boolean; reason: string } | null;
  const QUALIFIERS_REASON: Record<string, string> = {
    category_not_found: "Categoría no encontrada.",
    forbidden: "No autorizado.",
    bracket_already_exists: "Ya se generó el cuadro: no se pueden recalcular los clasificados sin borrarlo primero.",
    invalid_registration: "Alguno de los clasificados no pertenece a esta categoría.",
  };
  if (!res?.ok) return { ok: false, message: QUALIFIERS_REASON[res?.reason ?? ""] ?? "No se pudieron guardar los clasificados." };
  revalidatePath(`/admin/torneos/${tournamentId}`);
  return { ok: true, message: "Clasificados generados." };
}

const BRACKET_REASON_MESSAGES: Record<string, string> = {
  category_not_found: "Categoría no encontrada.",
  forbidden: "No autorizado.",
  qualifiers_not_generated: "Generá los clasificados antes de armar el cuadro.",
  bracket_started: "El cuadro ya tiene partidos jugados o en curso: no se puede rehacer.",
};

/** Genera el cuadro eliminatorio a partir de los clasificados ya sembrados (buildSeededEliminationFixture). */
export async function generateBracketAction(tournamentId: string, categoryId: string): Promise<ActionResult> {
  const gate = await assertCategoryOwner(tournamentId, categoryId);
  if (!gate.ok) return gate;
  const service = createServiceClient();

  const { data: qualified } = await service
    .from(DB_TABLES.tournamentRegistrations)
    .select("id, zone_id, qualified_seed")
    .eq("category_id", categoryId)
    .not("qualified_seed", "is", null)
    .order("qualified_seed", { ascending: true });
  const entries: SeededEntry[] = ((qualified ?? []) as Array<{ id: string; zone_id: string | null; qualified_seed: number }>).map((r) => ({
    seed: r.qualified_seed,
    pairId: r.id,
    zoneId: r.zone_id,
  }));
  if (entries.length === 0) return { ok: false, message: "Generá los clasificados antes de armar el cuadro." };

  const fixture = buildSeededEliminationFixture(entries);
  if (!fixture.ok) return { ok: false, message: fixture.message };

  const supabase = await createClient({ allowCookieWrites: true });
  const payload = fixture.rows.map((r) => ({
    id: r.id,
    round: r.round,
    roundName: r.roundName,
    slot: r.slot,
    pair1Id: r.pair1Id,
    pair2Id: r.pair2Id,
    feederLeftMatchId: r.feederLeftMatchId,
    feederRightMatchId: r.feederRightMatchId,
  }));
  const { data, error } = await supabase.rpc("tournament_persist_bracket", { p_category_id: categoryId, p_matches: payload });
  if (error) return { ok: false, message: "No se pudo generar el cuadro." };
  const res = firstRow(data) as { ok: boolean; reason: string; matches_created: number } | null;
  if (!res?.ok) return { ok: false, message: BRACKET_REASON_MESSAGES[res?.reason ?? ""] ?? "No se pudo generar el cuadro." };

  revalidatePath(`/admin/torneos/${tournamentId}`);
  return {
    ok: true,
    message: fixture.explanation ? `Cuadro generado. ${fixture.explanation}` : "Cuadro generado.",
  };
}
