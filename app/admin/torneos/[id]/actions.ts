"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createGroupChat } from "@/lib/group-chats";
import { createNotification } from "@/lib/notifications";
import { saveTournamentMatchResultAndElo } from "@/lib/tournament-elo-apply";
import { createClient, createServiceClient } from "@/utils/supabase/server";

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function roundNameByMatches(matchesInRound: number): string {
  if (matchesInRound >= 8) return "Octavos de final";
  if (matchesInRound === 4) return "Cuartos de final";
  if (matchesInRound === 2) return "Semifinal";
  if (matchesInRound === 1) return "Final";
  return `Ronda (${matchesInRound} partidos)`;
}

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
  const ttype = String((gate.row as { tournament_type?: string }).tournament_type ?? "");

  if (pairIds.length < 2) {
    return { ok: false, message: "Se necesitan al menos 2 inscripciones pagadas." };
  }

  if ((ttype === "eliminacion" || ttype === "grupos_eliminacion") && !isPowerOfTwo(pairIds.length)) {
    return { ok: false, message: "Eliminación requiere cantidad de parejas potencia de 2 (p. ej. 8, 16)." };
  }

  await service.from(DB_TABLES.tournamentMatches).delete().eq("tournament_id", tournamentId);

  if (ttype === "americano" || ttype === "grupos_eliminacion") {
    let round = 1;
    const rows: Array<Record<string, unknown>> = [];
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
        round += 1;
      }
    }
    if (rows.length) {
      const { error } = await service.from(DB_TABLES.tournamentMatches).insert(rows);
      if (error) return { ok: false, message: error.message };
    }
  } else if (ttype === "mixing") {
    const shuffled = [...pairIds].sort(() => Math.random() - 0.5);
    const rows: Array<Record<string, unknown>> = [];
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
    if (rows.length) {
      const { error } = await service.from(DB_TABLES.tournamentMatches).insert(rows);
      if (error) return { ok: false, message: error.message };
    }
  } else {
    let layerIds: string[] = [];
    const r1: Array<Record<string, unknown>> = [];
    const rn = pairIds.length / 2;
    for (let i = 0; i < pairIds.length; i += 2) {
      r1.push({
        tournament_id: tournamentId,
        round: 1,
        round_name: roundNameByMatches(rn),
        pair1_id: pairIds[i],
        pair2_id: pairIds[i + 1],
        status: "pending",
      });
    }
    const { data: ins1, error: e1 } = await service.from(DB_TABLES.tournamentMatches).insert(r1).select("id");
    if (e1) return { ok: false, message: e1.message };
    layerIds = ((ins1 ?? []) as { id: string }[]).map((x) => x.id);
    let roundNum = 2;
    while (layerIds.length > 1) {
      const next: Array<Record<string, unknown>> = [];
      for (let i = 0; i < layerIds.length; i += 2) {
        next.push({
          tournament_id: tournamentId,
          round: roundNum,
          round_name: roundNameByMatches(layerIds.length / 2),
          feeder_left_match_id: layerIds[i],
          feeder_right_match_id: layerIds[i + 1],
          status: "pending",
        });
      }
      const { data: insN, error: eN } = await service.from(DB_TABLES.tournamentMatches).insert(next).select("id");
      if (eN) return { ok: false, message: eN.message };
      layerIds = ((insN ?? []) as { id: string }[]).map((x) => x.id);
      roundNum += 1;
    }
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

  if (res.ok) {
    const { data: matchRow } = await service
      .from(DB_TABLES.tournamentMatches)
      .select("winner_pair_id, pair1_id, pair2_id")
      .eq("id", matchId)
      .maybeSingle();

    const winnerId = (matchRow as { winner_pair_id?: string | null } | null)?.winner_pair_id;
    if (winnerId) {
      const { data: nextLeft } = await service
        .from(DB_TABLES.tournamentMatches)
        .select("id, pair1_id")
        .eq("feeder_left_match_id", matchId)
        .maybeSingle();

      const { data: nextRight } = await service
        .from(DB_TABLES.tournamentMatches)
        .select("id, pair2_id")
        .eq("feeder_right_match_id", matchId)
        .maybeSingle();

      if (nextLeft) {
        await service
          .from(DB_TABLES.tournamentMatches)
          .update({ pair1_id: winnerId })
          .eq("id", (nextLeft as { id: string }).id);
      }
      if (nextRight) {
        await service
          .from(DB_TABLES.tournamentMatches)
          .update({ pair2_id: winnerId })
          .eq("id", (nextRight as { id: string }).id);
      }
    }

    const m = matchRow as { pair1_id: string | null; pair2_id: string | null } | null;
    const pairIds = [m?.pair1_id, m?.pair2_id].filter(Boolean) as string[];
    if (pairIds.length > 0) {
      const { data: regRows } = await service
        .from(DB_TABLES.tournamentRegistrations)
        .select("player1_id, player2_id")
        .in("id", pairIds);

      const playerIds = ((regRows ?? []) as Array<{ player1_id: string; player2_id: string | null }>).flatMap(
        (r) => [r.player1_id, r.player2_id].filter(Boolean) as string[]
      );

      for (const uid of playerIds) {
        await createNotification(service, {
          user_id: uid,
          type: "tournament_event",
          title: "Resultado cargado",
          body: `Se cargó el resultado de tu partido en el torneo "${tname}". Revisá el fixture.`,
        });
      }
    }
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

export async function removeRegistrationAction(registrationId: string, tournamentId: string) {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;
  const { error } = await supabase.from(DB_TABLES.tournamentRegistrations).delete().eq("id", registrationId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/admin/torneos/${tournamentId}`);
  return { ok: true, message: "Inscripción eliminada." };
}
