"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createGroupChat } from "@/lib/group-chats";
import { createNotification } from "@/lib/notifications";
import { saveTournamentMatchResultAndElo } from "@/lib/tournament-elo-apply";
import {
  buildAmericanoMatches,
  buildEliminationFirstRound,
  buildEliminationNextLayer,
  buildMixingRound1,
} from "@/lib/tournament/fixture";
import { validatePairsForType } from "@/lib/tournament/validation";
import type { TournamentTypeKey } from "@/lib/tournament-constants";
import { createClient, createServiceClient } from "@/utils/supabase/server";

async function assertTournamentOwner(supabase: SupabaseClient, tournamentId: string) {
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false as const, message: "Sesión requerida." };
  const { data: t } = await supabase
    .from(DB_TABLES.tournaments)
    .select("id, club_id, name, status, tournament_type, group_chat_id")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!t) return { ok: false as const, message: "Torneo no encontrado." };
  const row = t as { club_id: string };
  if (!ctx.clubIds.includes(row.club_id)) return { ok: false as const, message: "No autorizado." };
  return { ok: true as const, ctx, row: t as Record<string, unknown> };
}

export async function startTournamentFormAction(formData: FormData): Promise<void> {
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  if (!tournamentId) return;
  await startTournamentAction(tournamentId);
}

export async function finishTournamentFormAction(formData: FormData): Promise<void> {
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  if (!tournamentId) return;
  await finishTournamentAction(tournamentId);
}

export async function startTournamentAction(tournamentId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;
  const service = createServiceClient();

  const { data: regs } = await service
    .from(DB_TABLES.tournamentRegistrations)
    .select("id, player1_id, player2_id, payment_status, waitlist")
    .eq("tournament_id", tournamentId)
    .eq("payment_status", "approved")
    .eq("waitlist", false);

  const pairIds = ((regs ?? []) as Array<{ id: string }>).map((r) => r.id);
  const ttype = String((gate.row as { tournament_type?: string }).tournament_type ?? "") as TournamentTypeKey;

  const validation = validatePairsForType(ttype, pairIds.length);
  if (!validation.ok) return validation;

  await service.from(DB_TABLES.tournamentMatches).delete().eq("tournament_id", tournamentId);

  if (ttype === "americano") {
    const rows = buildAmericanoMatches(tournamentId, pairIds);
    if (rows.length) {
      const { error } = await service.from(DB_TABLES.tournamentMatches).insert(rows);
      if (error) return { ok: false, message: error.message };
    }
  } else if (ttype === "mixing") {
    const rows = buildMixingRound1(tournamentId, pairIds);
    if (rows.length) {
      const { error } = await service.from(DB_TABLES.tournamentMatches).insert(rows);
      if (error) return { ok: false, message: error.message };
    }
  } else if (ttype === "eliminacion") {
    const firstRound = buildEliminationFirstRound(tournamentId, pairIds);
    const { data: ins1, error: e1 } = await service.from(DB_TABLES.tournamentMatches).insert(firstRound).select("id");
    if (e1) return { ok: false, message: e1.message };
    let layerIds = ((ins1 ?? []) as { id: string }[]).map((x) => x.id);
    let roundNum = 2;
    while (layerIds.length > 1) {
      const next = buildEliminationNextLayer(tournamentId, roundNum, layerIds);
      const { data: insN, error: eN } = await service.from(DB_TABLES.tournamentMatches).insert(next).select("id");
      if (eN) return { ok: false, message: eN.message };
      layerIds = ((insN ?? []) as { id: string }[]).map((x) => x.id);
      roundNum++;
    }
  } else {
    return { ok: false, message: `Tipo de torneo "${ttype}" no implementado.` };
  }

  const tname = String((gate.row as { name?: string }).name ?? "Torneo");
  const memberIds = [
    ...new Set(
      ((regs ?? []) as Array<{ player1_id: string; player2_id: string | null }>).flatMap((r) =>
        [r.player1_id, r.player2_id].filter(Boolean) as string[]
      )
    ),
  ];
  const chat = await createGroupChat(supabase, gate.ctx.userId, `Chat · ${tname}`, "Grupo del torneo", memberIds, null);
  if (chat.ok && chat.groupId) {
    await service.from(DB_TABLES.tournaments).update({ group_chat_id: chat.groupId }).eq("id", tournamentId);
  }

  await service.from(DB_TABLES.tournaments).update({ status: "in_progress" }).eq("id", tournamentId);

  for (const uid of memberIds) {
    await createNotification(service, {
      user_id: uid,
      type: "tournament_event",
      title: "¡Comenzó el torneo!",
      body: `El torneo "${tname}" ya está en curso. Revisá el fixture en la app.`,
    });
  }

  revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath("/admin/torneos");
  revalidatePath("/torneos");
  return { ok: true, message: "Torneo iniciado y fixture generado." };
}

export async function finishTournamentAction(tournamentId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;
  const service = createServiceClient();
  const tname = String((gate.row as { name?: string }).name ?? "Torneo");

  await service.from(DB_TABLES.tournaments).update({ status: "finished" }).eq("id", tournamentId);

  const { data: regs } = await service
    .from(DB_TABLES.tournamentRegistrations)
    .select("player1_id, player2_id")
    .eq("tournament_id", tournamentId)
    .eq("payment_status", "approved");

  const ids = new Set<string>();
  for (const r of (regs ?? []) as Array<{ player1_id: string; player2_id: string | null }>) {
    ids.add(r.player1_id);
    if (r.player2_id) ids.add(r.player2_id);
  }
  for (const uid of ids) {
    await createNotification(service, {
      user_id: uid,
      type: "tournament_event",
      title: "Torneo finalizado",
      body: `El torneo "${tname}" terminó. ¡Gracias por participar!`,
    });
  }

  revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath("/torneos");
  return { ok: true, message: "Torneo finalizado." };
}

export async function saveTournamentMatchAction(
  tournamentId: string,
  matchId: string,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;

  const s1 = Number(formData.get("pair1_score"));
  const s2 = Number(formData.get("pair2_score"));
  const setsRaw = String(formData.get("sets_json") ?? "").trim();
  let setsJson: unknown = null;
  if (setsRaw) {
    try {
      setsJson = JSON.parse(setsRaw) as unknown;
    } catch {
      return { ok: false, message: "JSON de sets inválido." };
    }
  }

  if (!Number.isFinite(s1) || !Number.isFinite(s2) || s1 < 0 || s2 < 0) {
    return { ok: false, message: "Scores inválidos." };
  }
  if (s1 === s2) {
    return { ok: false, message: "No puede haber empate — uno debe ganar más sets." };
  }
  if (s1 > 3 || s2 > 3) {
    return { ok: false, message: "El máximo de sets es 3." };
  }

  const service = createServiceClient();
  const tname = String((gate.row as { name?: string }).name ?? "Torneo");

  const { data: existing } = await service
    .from(DB_TABLES.tournamentMatches)
    .select("pair1_id, pair2_id, status")
    .eq("id", matchId)
    .maybeSingle();

  const em = existing as { pair1_id: string | null; pair2_id: string | null; status: string } | null;
  if (!em?.pair1_id || !em.pair2_id) {
    return { ok: false, message: "Faltan parejas en el partido." };
  }

  const winnerPairId = s1 > s2 ? em.pair1_id : em.pair2_id;
  let res: { ok: boolean; message: string };

  if (em.status === "finished") {
    const { error } = await service
      .from(DB_TABLES.tournamentMatches)
      .update({
        pair1_score: s1,
        pair2_score: s2,
        sets: (setsJson ?? []) as never,
        winner_pair_id: winnerPairId,
        status: "finished",
      })
      .eq("id", matchId);
    res = error ? { ok: false, message: error.message } : { ok: true, message: "Resultado actualizado." };
  } else {
    res = await saveTournamentMatchResultAndElo({
      admin: service,
      matchId,
      pair1Score: s1,
      pair2Score: s2,
      setsJson: setsJson ?? [],
      tournamentName: tname,
    });
  }

  revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath(`/torneos/${tournamentId}`);
  return res;
}

export async function saveTournamentMatchFormAction(formData: FormData): Promise<void> {
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  const matchId = String(formData.get("match_id") ?? "").trim();
  if (!tournamentId || !matchId) return;
  await saveTournamentMatchAction(tournamentId, matchId, formData);
}

export async function saveMatchScheduleAction(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  const matchId = String(formData.get("match_id") ?? "").trim();
  if (!tournamentId || !matchId) return { ok: false, message: "Datos incompletos." };

  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;

  const courtId = String(formData.get("court_id") ?? "").trim() || null;
  const scheduledDate = String(formData.get("scheduled_date") ?? "").trim() || null;
  const scheduledTime = String(formData.get("scheduled_time") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const service = createServiceClient();
  const { error } = await service
    .from(DB_TABLES.tournamentMatches)
    .update({ court_id: courtId, scheduled_date: scheduledDate, scheduled_time: scheduledTime, notes })
    .eq("id", matchId);

  if (error) return { ok: false, message: error.message };
  revalidatePath(`/admin/torneos/${tournamentId}`);
  return { ok: true, message: "Horario guardado." };
}

export async function removeRegistrationAction(registrationId: string, tournamentId: string) {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;
  const { error } = await supabase.from(DB_TABLES.tournamentRegistrations).delete().eq("id", registrationId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/admin/torneos/${tournamentId}`);
  return { ok: true, message: "Inscripción eliminada." };
}
