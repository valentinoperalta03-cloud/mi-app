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
      "id, club_id, name, status, tournament_type, group_chat_id, consolation_bracket",
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
