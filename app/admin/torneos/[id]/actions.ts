"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createGroupChat } from "@/lib/group-chats";
import { createNotification } from "@/lib/notifications";
import { PROFILE_CATEGORIES } from "@/lib/profile-display";
import {
  propagateBracket,
  saveTournamentMatchResult,
} from "@/lib/tournament-match-result";
import {
  buildAmericanoMatches,
  buildEliminationFixture,
  buildPenaFirstRound,
} from "@/lib/tournament/fixture";
import {
  buildSlotsForDay,
  parseClockToMinutes,
  parseCloseTimeToMinutes,
  type ClubHoursBounds,
  type CourtTimeRangeInput,
} from "@/lib/court-slots";
import { FINAL_ROUND, THIRD_PLACE_ROUND } from "@/lib/tournament/rounds";
import {
  buildAmericanoRanking,
  type MatchForRanking,
} from "@/lib/tournament/ranking";
import { validatePairsForType } from "@/lib/tournament/validation";
import type { TournamentTypeKey } from "@/lib/tournament-constants";
import { createClient, createServiceClient } from "@/utils/supabase/server";

async function assertTournamentOwner(
  supabase: SupabaseClient,
  tournamentId: string,
) {
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false as const, message: "Sesión requerida." };
  const { data: t } = await supabase
    .from(DB_TABLES.tournaments)
    .select(
      "id, club_id, name, status, tournament_type, group_chat_id, consolation_bracket, has_finals",
    )
    .eq("id", tournamentId)
    .maybeSingle();
  if (!t) return { ok: false as const, message: "Torneo no encontrado." };
  const row = t as { club_id: string };
  if (!ctx.clubIds.includes(row.club_id))
    return { ok: false as const, message: "No autorizado." };
  return { ok: true as const, ctx, row: t as Record<string, unknown> };
}

export async function startTournamentFormAction(
  formData: FormData,
): Promise<void> {
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  if (!tournamentId) return;
  await startTournamentAction(tournamentId);
}

export async function finishTournamentFormAction(
  formData: FormData,
): Promise<void> {
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  if (!tournamentId) return;
  await finishTournamentAction(tournamentId);
}

export async function startTournamentAction(
  tournamentId: string,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;

  if ((gate.row as { status?: string }).status !== "open") {
    return { ok: false, message: "El torneo ya fue iniciado." };
  }

  const service = createServiceClient();

  const { data: regs } = await service
    .from(DB_TABLES.tournamentRegistrations)
    .select("id, player1_id, player2_id, payment_status, waitlist")
    .eq("tournament_id", tournamentId)
    .eq("payment_status", "approved")
    .eq("waitlist", false)
    .order("registration_order", { ascending: true })
    .order("registered_at", { ascending: true });

  const pairIds = ((regs ?? []) as Array<{ id: string }>).map((r) => r.id);
  const ttype = String(
    (gate.row as { tournament_type?: string }).tournament_type ?? "",
  ) as TournamentTypeKey;
  const consolationBracket = Boolean(
    (gate.row as { consolation_bracket?: boolean | null }).consolation_bracket,
  );

  const validation = validatePairsForType(ttype, pairIds.length);
  if (!validation.ok) return validation;

  await service
    .from(DB_TABLES.tournamentMatches)
    .delete()
    .eq("tournament_id", tournamentId);

  if (ttype === "americano") {
    const rows = buildAmericanoMatches(tournamentId, pairIds);
    if (rows.length) {
      const { error } = await service
        .from(DB_TABLES.tournamentMatches)
        .insert(rows);
      if (error) return { ok: false, message: error.message };
    }
  } else if (ttype === "pena") {
    const slots = (
      (regs ?? []) as Array<{ id: string; player1_id: string }>
    ).map((r) => ({
      registrationId: r.id,
      playerId: r.player1_id,
    }));
    const { matches, merges } = buildPenaFirstRound(tournamentId, slots);

    // La inscripción de peña es individual: cada pareja sorteada se materializa
    // fusionando dos inscripciones (una absorbe a la otra como player2_id) para
    // que pair1_id/pair2_id de tournament_matches puedan seguir referenciando
    // una única fila de tournament_registrations, igual que en americano/eliminación.
    for (const m of merges) {
      const { error: mergeErr } = await service
        .from(DB_TABLES.tournamentRegistrations)
        .update({ player2_id: m.mergePlayerId })
        .eq("id", m.keepRegistrationId);
      if (mergeErr) return { ok: false, message: mergeErr.message };
      const { error: removeErr } = await service
        .from(DB_TABLES.tournamentRegistrations)
        .delete()
        .eq("id", m.removeRegistrationId);
      if (removeErr) return { ok: false, message: removeErr.message };
    }

    if (matches.length) {
      const { error } = await service
        .from(DB_TABLES.tournamentMatches)
        .insert(matches);
      if (error) return { ok: false, message: error.message };
    }
  } else if (ttype === "eliminacion") {
    const rows = buildEliminationFixture(
      tournamentId,
      pairIds,
      consolationBracket,
    );
    if (rows.length) {
      const { error } = await service
        .from(DB_TABLES.tournamentMatches)
        .insert(rows);
      if (error) return { ok: false, message: error.message };
    }
  } else {
    return { ok: false, message: `Tipo de torneo "${ttype}" no soportado.` };
  }

  const tname = String((gate.row as { name?: string }).name ?? "Torneo");
  const memberIds = [
    ...new Set(
      (
        (regs ?? []) as Array<{ player1_id: string; player2_id: string | null }>
      ).flatMap(
        (r) => [r.player1_id, r.player2_id].filter(Boolean) as string[],
      ),
    ),
  ];
  const chat = await createGroupChat(
    supabase,
    gate.ctx.userId,
    `Chat · ${tname}`,
    "Grupo del torneo",
    memberIds,
    null,
  );
  if (chat.ok && chat.groupId) {
    await service
      .from(DB_TABLES.tournaments)
      .update({ group_chat_id: chat.groupId })
      .eq("id", tournamentId);
  }

  const { error: statusErr } = await service
    .from(DB_TABLES.tournaments)
    .update({ status: "in_progress", fixture_locked: true })
    .eq("id", tournamentId);
  if (statusErr) return { ok: false, message: statusErr.message };

  const clubId = String((gate.row as { club_id?: string }).club_id ?? "");
  const clubName =
    gate.ctx.clubs.find((c) => c.id === clubId)?.name ?? "el club";
  const isPena = ttype === "pena";
  const notifTitle = isPena ? "¡Tu peña comenzó! 🎉" : "¡Tu torneo comenzó! 🏆";
  const notifBody = isPena
    ? `${tname} en ${clubName} ya está en marcha. Revisá tu pareja y cancha asignada.`
    : `${tname} en ${clubName} ya está en marcha. Revisá el fixture.`;

  for (const uid of memberIds) {
    await createNotification(service, {
      user_id: uid,
      type: "tournament_event",
      title: notifTitle,
      body: notifBody,
    });
  }

  revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath("/admin/torneos");
  revalidatePath("/torneos");
  return { ok: true, message: "Torneo iniciado y fixture generado." };
}

export async function finishTournamentAction(
  tournamentId: string,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;
  const service = createServiceClient();
  const tname = String((gate.row as { name?: string }).name ?? "Torneo");
  const tournamentType = String(
    (gate.row as { tournament_type?: string }).tournament_type ?? "",
  );

  // Las peñas no cargan resultados (saveTournamentMatchAction las rechaza),
  // así que nunca tendrían partidos en status 'finished' — sin esta excepción
  // el torneo queda bloqueado para siempre en "Finalizar".
  if (tournamentType !== "pena") {
    const { count } = await service
      .from(DB_TABLES.tournamentMatches)
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)
      .neq("status", "finished");
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        message: `Hay ${count} partido${count === 1 ? "" : "s"} sin resultado. Cargalos antes de cerrar el torneo.`,
      };
    }
  }

  await service
    .from(DB_TABLES.tournaments)
    .update({ status: "finished" })
    .eq("id", tournamentId);

  const { data: regs } = await service
    .from(DB_TABLES.tournamentRegistrations)
    .select("player1_id, player2_id")
    .eq("tournament_id", tournamentId)
    .eq("payment_status", "approved");

  const ids = new Set<string>();
  for (const r of (regs ?? []) as Array<{
    player1_id: string;
    player2_id: string | null;
  }>) {
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

export async function cancelTournamentFormAction(
  formData: FormData,
): Promise<void> {
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  if (!tournamentId) return;
  await cancelTournamentAction(tournamentId);
}

export async function cancelTournamentAction(
  tournamentId: string,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;

  const status = (gate.row as { status?: string }).status;
  if (status === "finished" || status === "cancelled") {
    return { ok: false, message: "El torneo ya terminó." };
  }

  const service = createServiceClient();
  const { error } = await service
    .from(DB_TABLES.tournaments)
    .update({ status: "cancelled" })
    .eq("id", tournamentId);
  if (error) return { ok: false, message: error.message };

  const tname = String((gate.row as { name?: string }).name ?? "Torneo");
  const { data: regs } = await service
    .from(DB_TABLES.tournamentRegistrations)
    .select("player1_id, player2_id")
    .eq("tournament_id", tournamentId);
  const ids = new Set<string>();
  for (const r of (regs ?? []) as Array<{
    player1_id: string;
    player2_id: string | null;
  }>) {
    ids.add(r.player1_id);
    if (r.player2_id) ids.add(r.player2_id);
  }
  for (const uid of ids) {
    await createNotification(service, {
      user_id: uid,
      type: "tournament_event",
      title: "Torneo cancelado",
      body: `El club canceló "${tname}".`,
    });
  }

  revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath("/admin/torneos");
  revalidatePath("/torneos");
  return { ok: true, message: "Torneo cancelado." };
}

/** Baja una pareja/jugador inscripto — solo mientras la inscripción está abierta. Notifica a los afectados. */
export async function cancelRegistrationAction(
  formData: FormData,
): Promise<void> {
  const registrationId = String(formData.get("registration_id") ?? "").trim();
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  if (!registrationId || !tournamentId) redirect("/admin/torneos");

  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) redirect("/admin/torneos");

  if ((gate.row as { status?: string }).status !== "open") {
    redirect(`/admin/torneos/${tournamentId}`);
  }

  const service = createServiceClient();
  const { data: reg } = await service
    .from(DB_TABLES.tournamentRegistrations)
    .select("player1_id, player2_id")
    .eq("id", registrationId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();

  const { error } = await service
    .from(DB_TABLES.tournamentRegistrations)
    .delete()
    .eq("id", registrationId)
    .eq("tournament_id", tournamentId);

  if (!error && reg) {
    const tname = String((gate.row as { name?: string }).name ?? "Torneo");
    const r = reg as { player1_id: string; player2_id: string | null };
    const ids = [r.player1_id, r.player2_id].filter(Boolean) as string[];
    for (const uid of ids) {
      await createNotification(service, {
        user_id: uid,
        type: "tournament_event",
        title: "Te bajaron del torneo",
        body: `El club dio de baja tu inscripción en "${tname}".`,
      });
    }
  }

  revalidatePath(`/admin/torneos/${tournamentId}`);
  redirect(`/admin/torneos/${tournamentId}`);
}

/** Campos editables mientras el torneo está abierto — el tipo no se puede cambiar (define el fixture). */
export async function updateTournamentAction(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  if (!tournamentId) return { ok: false, message: "Torneo inválido." };

  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;

  if ((gate.row as { status?: string }).status !== "open") {
    return {
      ok: false,
      message: "Solo se puede editar mientras la inscripción está abierta.",
    };
  }

  const tournamentType = String(
    (gate.row as { tournament_type?: string }).tournament_type ?? "",
  );
  const isPena = tournamentType === "pena";

  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "")
    .trim()
    .slice(0, 8);
  const registrationDeadline = String(
    formData.get("registration_deadline") ?? "",
  ).trim();
  const maxPairs = Number(formData.get("max_pairs") ?? 16);
  const pricePerPair = Number(formData.get("price_per_pair") ?? 0);

  if (!name) return { ok: false, message: "Nombre obligatorio." };
  if (!startDate || !endDate || !startTime || !registrationDeadline) {
    return { ok: false, message: "Completá fechas y hora." };
  }
  if (!Number.isFinite(maxPairs) || maxPairs < 2)
    return { ok: false, message: "Máximo inválido." };
  if (!Number.isFinite(pricePerPair) || pricePerPair < 0)
    return { ok: false, message: "Precio inválido." };
  if (startDate > endDate) {
    return {
      ok: false,
      message:
        "La fecha de inicio debe ser anterior o igual a la fecha de fin.",
    };
  }
  if (registrationDeadline.slice(0, 10) > startDate) {
    return {
      ok: false,
      message:
        "El cierre de inscripción debe ser anterior o en la misma fecha que el inicio.",
    };
  }

  const allowedCategories = formData
    .getAll("allowed_categories")
    .map((v) => String(v).trim())
    .filter((c): c is (typeof PROFILE_CATEGORIES)[number] =>
      PROFILE_CATEGORIES.includes(c as (typeof PROFILE_CATEGORIES)[number]),
    );
  const hasFinals = formData.get("has_finals") !== "false";
  const matchFormat =
    String(formData.get("match_format") ?? "set").trim() || "set";
  const matchDurationRaw = Number(formData.get("match_duration_minutes") ?? 0);
  const consolationBracket =
    tournamentType === "eliminacion" &&
    formData.get("consolation_bracket") === "true";
  const multiDay = formData.get("multi_day") === "true";
  const numCourtsRaw = Number(formData.get("num_courts") ?? 0);
  const numCourts =
    Number.isFinite(numCourtsRaw) && numCourtsRaw > 0
      ? Math.floor(numCourtsRaw)
      : null;
  const foodIncluded =
    String(formData.get("food_included") ?? "").trim() || null;
  const whatIncludes = isPena
    ? formData
        .getAll("what_includes")
        .map((v) => String(v).trim())
        .filter(Boolean)
    : [];

  const service = createServiceClient();
  const { error } = await service
    .from(DB_TABLES.tournaments)
    .update({
      name,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
      registration_deadline: registrationDeadline,
      max_pairs: Math.floor(maxPairs),
      price_per_pair: pricePerPair,
      allowed_categories:
        allowedCategories.length > 0 ? allowedCategories : null,
      has_finals: hasFinals,
      match_format: matchFormat,
      match_duration_minutes:
        matchFormat === "tiempo" && matchDurationRaw > 0
          ? Math.floor(matchDurationRaw)
          : null,
      consolation_bracket: consolationBracket,
      multi_day: multiDay,
      num_courts: numCourts,
      food_included: foodIncluded,
      what_includes: whatIncludes,
    })
    .eq("id", tournamentId);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath("/admin/torneos");
  revalidatePath("/torneos");
  return { ok: true, message: "Torneo actualizado." };
}

/**
 * Si el torneo es americano con `has_finals`, y ya terminaron todos los
 * partidos de todos-contra-todos (round < FINAL_ROUND) sin que la Final ya
 * exista, genera 1er-vs-2do (Final) y 3ro-vs-4to (3er puesto) según la tabla
 * de posiciones acumulada hasta ese momento.
 */
async function maybeGenerateAmericanoFinals(
  service: SupabaseClient,
  tournamentId: string,
  hasFinals: boolean,
): Promise<void> {
  if (!hasFinals) return;

  const { data: allMatches } = await service
    .from(DB_TABLES.tournamentMatches)
    .select("id, round, pair1_id, pair2_id, pair1_score, pair2_score, status")
    .eq("tournament_id", tournamentId);
  const rows = (allMatches ?? []) as Array<{
    id: string;
    round: number;
    pair1_id: string | null;
    pair2_id: string | null;
    pair1_score: number | null;
    pair2_score: number | null;
    status: string;
  }>;

  const regular = rows.filter((m) => m.round < FINAL_ROUND);
  const alreadyGenerated = rows.some((m) => m.round >= FINAL_ROUND);
  if (alreadyGenerated || regular.length === 0) return;
  if (regular.some((m) => m.status !== "finished")) return;

  const ranking = buildAmericanoRanking(regular as MatchForRanking[]);
  if (ranking.length < 2) return;

  const toInsert: Array<Record<string, unknown>> = [
    {
      tournament_id: tournamentId,
      round: FINAL_ROUND,
      round_name: "Final",
      pair1_id: ranking[0].pairId,
      pair2_id: ranking[1].pairId,
      status: "pending",
    },
  ];
  if (ranking.length >= 4) {
    toInsert.push({
      tournament_id: tournamentId,
      round: THIRD_PLACE_ROUND,
      round_name: "3er puesto",
      pair1_id: ranking[2].pairId,
      pair2_id: ranking[3].pairId,
      status: "pending",
    });
  }
  await service.from(DB_TABLES.tournamentMatches).insert(toInsert);
}

export async function saveTournamentMatchAction(
  tournamentId: string,
  matchId: string,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;

  if ((gate.row as { tournament_type?: string }).tournament_type === "pena") {
    return {
      ok: false,
      message: "Las peñas no cargan resultados ni afectan el ELO.",
    };
  }

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
    return {
      ok: false,
      message: "No puede haber empate — uno debe ganar más sets.",
    };
  }
  if (s1 > 3 || s2 > 3) {
    return { ok: false, message: "El máximo de sets es 3." };
  }

  const service = createServiceClient();
  const tname = String((gate.row as { name?: string }).name ?? "Torneo");

  const { data: existing } = await service
    .from(DB_TABLES.tournamentMatches)
    .select("pair1_id, pair2_id, status, winner_pair_id")
    .eq("id", matchId)
    .maybeSingle();

  const em = existing as {
    pair1_id: string | null;
    pair2_id: string | null;
    status: string;
    winner_pair_id: string | null;
  } | null;
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
    if (error) {
      res = { ok: false, message: error.message };
    } else {
      // Re-propagar bracket solo si el ganador cambió
      if (em.winner_pair_id !== winnerPairId) {
        await propagateBracket(service, matchId, winnerPairId);
      }
      res = { ok: true, message: "Resultado actualizado." };
    }
  } else {
    res = await saveTournamentMatchResult({
      admin: service,
      matchId,
      pair1Score: s1,
      pair2Score: s2,
      setsJson: setsJson ?? [],
      tournamentName: tname,
    });
  }

  if (
    res.ok &&
    (gate.row as { tournament_type?: string }).tournament_type === "americano"
  ) {
    const hasFinals =
      (gate.row as { has_finals?: boolean | null }).has_finals ?? true;
    await maybeGenerateAmericanoFinals(service, tournamentId, hasFinals);
  }

  revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath(`/torneos/${tournamentId}`);
  return res;
}

export async function saveTournamentMatchFormAction(
  formData: FormData,
): Promise<void> {
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  const matchId = String(formData.get("match_id") ?? "").trim();
  if (!tournamentId || !matchId) return;
  await saveTournamentMatchAction(tournamentId, matchId, formData);
}

export async function saveMatchScheduleAction(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  const matchId = String(formData.get("match_id") ?? "").trim();
  if (!tournamentId || !matchId)
    return { ok: false, message: "Datos incompletos." };

  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;

  const courtId = String(formData.get("court_id") ?? "").trim() || null;
  const scheduledDate =
    String(formData.get("scheduled_date") ?? "").trim() || null;
  const scheduledTime =
    String(formData.get("scheduled_time") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const service = createServiceClient();
  const { error } = await service
    .from(DB_TABLES.tournamentMatches)
    .update({
      court_id: courtId,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      notes,
    })
    .eq("id", matchId);

  if (error) return { ok: false, message: error.message };
  revalidatePath(`/admin/torneos/${tournamentId}`);
  return { ok: true, message: "Horario guardado." };
}

/**
 * Disponibilidad de canchas para una fecha puntual: slots generados a partir
 * de `court_time_ranges` (o el horario del club como fallback) menos lo ya
 * ocupado por reservas/partidos abiertos (`matches`), turnos fijos
 * (`fixed_slots` menos excepciones), entrenamientos (`training_blocks`) y
 * bloqueos puntuales (`court_blocks`, incluidos los de otros partidos de
 * torneo ya agendados con reason='torneo').
 */
export async function getCourtAvailabilityForDate(
  clubId: string,
  courtIds: string[],
  dateStr: string,
): Promise<{
  slots: string[];
  occupiedByCourtAndSlot: Record<string, Record<string, string>>;
}> {
  if (!courtIds.length) return { slots: [], occupiedByCourtAndSlot: {} };

  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !ctx.clubIds.includes(clubId)) {
    return { slots: [], occupiedByCourtAndSlot: {} };
  }

  const service = createServiceClient();
  const dayDate = new Date(`${dateStr}T12:00:00`);
  const dayOfWeek = dayDate.getDay();

  const [
    { data: club },
    { data: timeRangesRaw },
    { data: matchesRaw },
    { data: fixedSlotsRaw },
    { data: trainingMetaRaw },
    { data: blocksRaw },
  ] = await Promise.all([
    service
      .from(DB_TABLES.clubs)
      .select("open_time, close_time")
      .eq("id", clubId)
      .maybeSingle(),
    service
      .from(DB_TABLES.courtTimeRanges)
      .select("court_id, day_of_week, open_time, close_time")
      .in("court_id", courtIds),
    service
      .from(DB_TABLES.matches)
      .select(
        "court_id, scheduled_time, duration_minutes, match_status, match_type, es_turno_fijo",
      )
      .in("court_id", courtIds)
      .eq("scheduled_date", dateStr),
    service
      .from(DB_TABLES.fixedSlots)
      .select("id, court_id, start_time, duration_minutes")
      .in("court_id", courtIds)
      .eq("is_active", true)
      .eq("day_of_week", dayOfWeek),
    service
      .from(DB_TABLES.trainingBlocks)
      .select("court_id, start_time, end_time")
      .eq("club_id", clubId)
      .eq("is_active", true)
      .eq("day_of_week", dayOfWeek),
    service
      .from(DB_TABLES.courtBlocks)
      .select("court_id, blocked_time, reason")
      .in("court_id", courtIds)
      .eq("blocked_date", dateStr),
  ]);

  const fixedSlotIds = ((fixedSlotsRaw ?? []) as Array<{ id: string }>).map(
    (s) => s.id,
  );
  const { data: exceptionsRaw } = fixedSlotIds.length
    ? await service
        .from(DB_TABLES.fixedSlotExceptions)
        .select("fixed_slot_id")
        .in("fixed_slot_id", fixedSlotIds)
        .eq("exception_date", dateStr)
    : { data: [] };
  const exceptedIds = new Set(
    ((exceptionsRaw ?? []) as Array<{ fixed_slot_id: string }>).map(
      (e) => e.fixed_slot_id,
    ),
  );

  const timeRanges = (timeRangesRaw ?? []) as CourtTimeRangeInput[];
  const clubBounds = club as ClubHoursBounds | null;
  const slots = buildSlotsForDay(courtIds, dayDate, timeRanges, clubBounds).map(
    (g) => g.time,
  );

  const occupiedByCourtAndSlot: Record<string, Record<string, string>> = {};
  function mark(
    courtId: string,
    startMin: number,
    durationMin: number,
    label: string,
  ) {
    if (startMin < 0) return;
    const map = (occupiedByCourtAndSlot[courtId] ??= {});
    for (const slot of slots) {
      const slotMin = parseClockToMinutes(slot);
      if (slotMin >= startMin && slotMin < startMin + durationMin) {
        if (!map[slot]) map[slot] = label;
      }
    }
  }

  for (const m of (matchesRaw ?? []) as Array<{
    court_id: string;
    scheduled_time: string | null;
    duration_minutes: number | null;
    match_status: string | null;
    match_type: string | null;
    es_turno_fijo: boolean | null;
  }>) {
    if (m.es_turno_fijo) continue;
    if (String(m.match_status ?? "").toLowerCase() === "cancelled") continue;
    const startMin = parseClockToMinutes(String(m.scheduled_time ?? ""));
    const duration =
      m.duration_minutes && m.duration_minutes > 0 ? m.duration_minutes : 90;
    mark(
      m.court_id,
      startMin,
      duration,
      m.match_type === "amistoso" ? "Partido abierto" : "Reserva",
    );
  }

  for (const s of (fixedSlotsRaw ?? []) as Array<{
    id: string;
    court_id: string;
    start_time: string | null;
    duration_minutes: number | null;
  }>) {
    if (exceptedIds.has(s.id)) continue;
    const startMin = parseClockToMinutes(String(s.start_time ?? ""));
    const duration =
      s.duration_minutes && s.duration_minutes > 0 ? s.duration_minutes : 90;
    mark(s.court_id, startMin, duration, "Turno fijo");
  }

  for (const t of (trainingMetaRaw ?? []) as Array<{
    court_id: string;
    start_time: string;
    end_time: string;
  }>) {
    const startMin = parseClockToMinutes(String(t.start_time));
    const endMin = parseCloseTimeToMinutes(String(t.end_time));
    mark(
      t.court_id,
      startMin,
      Math.max(30, endMin - startMin),
      "Entrenamiento",
    );
  }

  for (const b of (blocksRaw ?? []) as Array<{
    court_id: string;
    blocked_time: string | null;
    reason: string | null;
  }>) {
    const startMin = parseClockToMinutes(String(b.blocked_time ?? ""));
    const label =
      b.reason === "torneo"
        ? "Torneo"
        : b.reason === "entrenamiento_externo"
          ? "Entrenamiento"
          : "Bloqueado";
    mark(b.court_id, startMin, 90, label);
  }

  return { slots, occupiedByCourtAndSlot };
}

/**
 * Asigna cancha/fecha/hora a un partido de torneo: re-verifica disponibilidad
 * en el server, libera el bloqueo anterior si el partido ya tenía uno propio
 * y crea el nuevo `court_block` (reason='torneo') para que quede reflejado en
 * el dashboard y en la disponibilidad de otros torneos/reservas.
 */
export async function assignTournamentMatchSlot(input: {
  matchId: string;
  courtId: string;
  matchDate: string;
  matchTime: string;
  clubId: string;
  tournamentId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, input.tournamentId);
  if (!gate.ok) return { ok: false, error: gate.message };

  const service = createServiceClient();

  const { data: existing } = await service
    .from(DB_TABLES.tournamentMatches)
    .select("court_id, scheduled_date, scheduled_time")
    .eq("id", input.matchId)
    .maybeSingle();
  const prev = existing as {
    court_id: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
  } | null;

  // Liberar el bloqueo anterior de este mismo partido ANTES de re-verificar
  // disponibilidad: si no, reasignar el partido al mismo horario que ya
  // tenía se marcaría (incorrectamente) como ocupado por su propio bloqueo.
  if (prev?.court_id && prev.scheduled_date && prev.scheduled_time) {
    await service
      .from(DB_TABLES.courtBlocks)
      .delete()
      .eq("court_id", prev.court_id)
      .eq("blocked_date", prev.scheduled_date)
      .eq("blocked_time", prev.scheduled_time)
      .eq("reason", "torneo");
  }

  const avail = await getCourtAvailabilityForDate(
    input.clubId,
    [input.courtId],
    input.matchDate,
  );
  const motivo = avail.occupiedByCourtAndSlot[input.courtId]?.[input.matchTime];
  if (motivo) {
    return { ok: false, error: "Ese horario ya está ocupado" };
  }

  const { error: updErr } = await service
    .from(DB_TABLES.tournamentMatches)
    .update({
      court_id: input.courtId,
      scheduled_date: input.matchDate,
      scheduled_time: input.matchTime,
    })
    .eq("id", input.matchId);
  if (updErr) return { ok: false, error: updErr.message };

  const { error: blockErr } = await service.from(DB_TABLES.courtBlocks).insert({
    court_id: input.courtId,
    blocked_date: input.matchDate,
    blocked_time: input.matchTime,
    reason: "torneo",
  });
  if (blockErr) return { ok: false, error: blockErr.message };

  revalidatePath(`/admin/torneos/${input.tournamentId}`);
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

/** Peña: reasignar qué pareja (registration ya fusionada) enfrenta a cuál en un partido. */
export async function updatePenaMatchPairsAction(
  tournamentId: string,
  matchId: string,
  pair1Id: string | null,
  pair2Id: string | null,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;

  if ((gate.row as { tournament_type?: string }).tournament_type !== "pena") {
    return { ok: false, message: "Solo aplica a peñas." };
  }

  const service = createServiceClient();
  const { error } = await service
    .from(DB_TABLES.tournamentMatches)
    .update({ pair1_id: pair1Id || null, pair2_id: pair2Id || null })
    .eq("id", matchId)
    .eq("tournament_id", tournamentId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/torneos/${tournamentId}`);
  return { ok: true, message: "Pareja actualizada." };
}

/**
 * Guarda el orden manual de inscripciones antes de iniciar el torneo. Ese
 * orden es el que usa startTournamentAction para armar los cruces del
 * fixture (pareja 1 vs pareja 2, pareja 3 vs pareja 4, etc.).
 */
export async function reorderTournamentRegistrationsAction(
  tournamentId: string,
  orderedIds: string[],
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;

  if ((gate.row as { status?: string }).status !== "open") {
    return {
      ok: false,
      message: "Solo se puede reordenar mientras la inscripción está abierta.",
    };
  }

  const service = createServiceClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await service
      .from(DB_TABLES.tournamentRegistrations)
      .update({ registration_order: i })
      .eq("id", orderedIds[i])
      .eq("tournament_id", tournamentId);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath(`/admin/torneos/${tournamentId}`);
  return { ok: true, message: "Orden guardado." };
}
