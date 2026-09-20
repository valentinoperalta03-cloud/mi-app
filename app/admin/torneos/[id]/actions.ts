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

  const currentStatus = (gate.row as { status?: string }).status;
  if (currentStatus !== "open" && currentStatus !== "registration_closed") {
    const message =
      currentStatus === "cancelled"
        ? "El torneo está cancelado."
        : currentStatus === "finished"
          ? "El torneo ya finalizó."
          : "El torneo ya fue iniciado.";
    return { ok: false, message };
  }

  const service = createServiceClient();

  const ttype = String(
    (gate.row as { tournament_type?: string }).tournament_type ?? "",
  ) as TournamentTypeKey;
  const consolationBracket = Boolean(
    (gate.row as { consolation_bracket?: boolean | null }).consolation_bracket,
  );

  if (!["americano", "pena", "eliminacion"].includes(ttype)) {
    return { ok: false, message: `Tipo de torneo "${ttype}" no soportado.` };
  }

  const { data: categoriesRaw } = await service
    .from(DB_TABLES.tournamentCategories)
    .select("id")
    .eq("tournament_id", tournamentId)
    .order("sort_order", { ascending: true });
  const categoryIds = ((categoriesRaw ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (categoryIds.length === 0) {
    return { ok: false, message: "El torneo no tiene categorías." };
  }

  // Cada categoría arma su propio fixture con SUS inscriptos únicamente —
  // categorías del mismo torneo (americano/eliminación/peña) nunca se
  // mezclan entre sí. Antes de esta fase, el fixture se armaba con TODAS las
  // inscripciones del torneo sin distinguir categoría (inofensivo mientras
  // solo existía una por torneo; con Fase B ya no).
  await service
    .from(DB_TABLES.tournamentMatches)
    .delete()
    .eq("tournament_id", tournamentId);

  const allRegs: Array<{ id: string; player1_id: string; player2_id: string | null }> = [];

  for (const categoryId of categoryIds) {
    const { data: regs } = await service
      .from(DB_TABLES.tournamentRegistrations)
      .select("id, player1_id, player2_id, payment_status, waitlist")
      .eq("category_id", categoryId)
      .eq("payment_status", "approved")
      .eq("waitlist", false)
      .order("registration_order", { ascending: true })
      .order("registered_at", { ascending: true });

    const catRegs = (regs ?? []) as Array<{ id: string; player1_id: string; player2_id: string | null }>;
    allRegs.push(...catRegs);
    const pairIds = catRegs.map((r) => r.id);

    const validation = validatePairsForType(ttype, pairIds.length);
    if (!validation.ok) return validation;

    if (ttype === "americano") {
      const rows = buildAmericanoMatches(tournamentId, pairIds).map((row) => ({ ...row, category_id: categoryId, phase: "americano" }));
      if (rows.length) {
        const { error } = await service.from(DB_TABLES.tournamentMatches).insert(rows);
        if (error) return { ok: false, message: error.message };
      }
    } else if (ttype === "pena") {
      const slots = catRegs.map((r) => ({ registrationId: r.id, playerId: r.player1_id }));
      const { matches, merges } = buildPenaFirstRound(tournamentId, slots);

      // La inscripción de peña es individual: cada pareja sorteada se materializa
      // fusionando dos inscripciones (una absorbe a la otra como player2_id) para
      // que pair1_id/pair2_id de tournament_matches puedan seguir referenciando
      // una única fila de tournament_registrations, igual que en americano/eliminación.
      for (const m of merges) {
        // Borrar ANTES de actualizar: mergePlayerId todavía ocupa su lugar
        // como player1 de removeRegistrationId (categoría+jugador es único a
        // nivel DB desde Fase B). Si se actualizara primero, el UPDATE de abajo
        // chocaría con esa fila todavía viva.
        const { error: removeErr } = await service
          .from(DB_TABLES.tournamentRegistrations)
          .delete()
          .eq("id", m.removeRegistrationId);
        if (removeErr) return { ok: false, message: removeErr.message };
        const { error: mergeErr } = await service
          .from(DB_TABLES.tournamentRegistrations)
          .update({ player2_id: m.mergePlayerId })
          .eq("id", m.keepRegistrationId);
        if (mergeErr) return { ok: false, message: mergeErr.message };
      }

      if (matches.length) {
        const rows = matches.map((row) => ({ ...row, category_id: categoryId, phase: "pena" }));
        const { error } = await service.from(DB_TABLES.tournamentMatches).insert(rows);
        if (error) return { ok: false, message: error.message };
      }
    } else {
      const rows = buildEliminationFixture(tournamentId, pairIds, consolationBracket).map((row) => ({
        ...row,
        category_id: categoryId,
        phase: "knockout",
      }));
      if (rows.length) {
        const { error } = await service.from(DB_TABLES.tournamentMatches).insert(rows);
        if (error) return { ok: false, message: error.message };
      }
    }
  }

  const tname = String((gate.row as { name?: string }).name ?? "Torneo");
  const memberIds = [
    ...new Set(allRegs.flatMap((r) => [r.player1_id, r.player2_id].filter(Boolean) as string[])),
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
  revalidatePath(`/torneos/${tournamentId}`);
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

  if ((gate.row as { status?: string }).status !== "in_progress") {
    return { ok: false, message: "Solo se puede finalizar un torneo en curso." };
  }

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

  const { error: finishErr } = await service
    .from(DB_TABLES.tournaments)
    .update({ status: "finished" })
    .eq("id", tournamentId);
  if (finishErr) return { ok: false, message: finishErr.message };

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
  revalidatePath("/admin/torneos");
  revalidatePath("/torneos");
  revalidatePath(`/torneos/${tournamentId}`);
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
  revalidatePath(`/torneos/${tournamentId}`);
  return { ok: true, message: "Torneo cancelado." };
}

/** Cierra la inscripción manualmente sin iniciar el torneo todavía. */
export async function closeTournamentRegistrationsAction(
  tournamentId: string,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;

  if ((gate.row as { status?: string }).status !== "open") {
    return { ok: false, message: "Solo se puede cerrar la inscripción mientras está abierta." };
  }

  const service = createServiceClient();
  const { error } = await service
    .from(DB_TABLES.tournaments)
    .update({ status: "registration_closed" })
    .eq("id", tournamentId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath("/admin/torneos");
  revalidatePath("/torneos");
  revalidatePath(`/torneos/${tournamentId}`);
  return { ok: true, message: "Inscripciones cerradas." };
}

export async function closeTournamentRegistrationsFormAction(
  formData: FormData,
): Promise<void> {
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  if (!tournamentId) return;
  await closeTournamentRegistrationsAction(tournamentId);
}

/** Reabre la inscripción de un torneo que estaba con registration_closed. */
export async function reopenTournamentRegistrationsAction(
  tournamentId: string,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;

  if ((gate.row as { status?: string }).status !== "registration_closed") {
    return { ok: false, message: "Solo se puede reabrir mientras la inscripción está cerrada." };
  }

  const service = createServiceClient();
  const { error } = await service
    .from(DB_TABLES.tournaments)
    .update({ status: "open" })
    .eq("id", tournamentId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath("/admin/torneos");
  revalidatePath("/torneos");
  revalidatePath(`/torneos/${tournamentId}`);
  return { ok: true, message: "Inscripciones reabiertas." };
}

export async function reopenTournamentRegistrationsFormAction(
  formData: FormData,
): Promise<void> {
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  if (!tournamentId) return;
  await reopenTournamentRegistrationsAction(tournamentId);
}

/**
 * Baja una pareja/jugador inscripto — solo mientras la inscripción está abierta.
 * No borra la fila: la marca cancelada para conservar el historial de pagos
 * (qué hacer con lo cobrado queda para el flujo de pagos). Notifica a los afectados.
 */
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
    .update({ payment_status: "cancelled", payment_expires_at: null })
    .eq("id", registrationId)
    .eq("tournament_id", tournamentId)
    .in("payment_status", ["pending_payment", "pending", "approved"]);

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
  const contactPhone =
    String(formData.get("contact_phone") ?? "").trim() || null;
  const prizesRaw = String(formData.get("prizes") ?? "").trim();
  let prizes: unknown = null;
  if (prizesRaw) {
    try {
      prizes = JSON.parse(prizesRaw);
    } catch {
      return { ok: false, message: "Premios inválidos." };
    }
  }

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
      contact_phone: contactPhone,
      prizes,
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
  categoryId: string,
  hasFinals: boolean,
): Promise<void> {
  if (!hasFinals) return;

  // Escopado por categoría: un torneo con varias categorías americano corre
  // el todos-contra-todos de cada una por separado, así que la final de una
  // categoría no puede esperar a que terminen los partidos de otra.
  const { data: allMatches } = await service
    .from(DB_TABLES.tournamentMatches)
    .select("id, round, pair1_id, pair2_id, pair1_score, pair2_score, status")
    .eq("tournament_id", tournamentId)
    .eq("category_id", categoryId);
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
      category_id: categoryId,
      phase: "americano_final",
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
      category_id: categoryId,
      phase: "americano_final",
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
      message: "Las peñas no cargan resultados.",
    };
  }

  if ((gate.row as { status?: string }).status !== "in_progress") {
    return {
      ok: false,
      message: "Solo se pueden cargar resultados con el torneo en curso.",
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

  // El partido tiene que pertenecer al torneo validado arriba: sin este filtro
  // un admin podía cargar resultados en partidos de otro club.
  const { data: existing } = await service
    .from(DB_TABLES.tournamentMatches)
    .select("pair1_id, pair2_id, status, winner_pair_id, category_id")
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!existing) return { ok: false, message: "Partido no encontrado." };

  const em = existing as {
    pair1_id: string | null;
    pair2_id: string | null;
    status: string;
    winner_pair_id: string | null;
    category_id: string | null;
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
      .eq("id", matchId)
      .eq("tournament_id", tournamentId);
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
      tournamentId,
      matchId,
      pair1Score: s1,
      pair2Score: s2,
      setsJson: setsJson ?? [],
      tournamentName: tname,
    });
  }

  if (
    res.ok &&
    (gate.row as { tournament_type?: string }).tournament_type === "americano" &&
    em?.category_id
  ) {
    const hasFinals =
      (gate.row as { has_finals?: boolean | null }).has_finals ?? true;
    await maybeGenerateAmericanoFinals(service, tournamentId, em.category_id, hasFinals);
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

/**
 * Asigna cancha/fecha/hora a un partido de torneo. Todo se valida en el
 * server contra el torneo del admin: el partido tiene que ser de ese torneo y
 * la cancha de su club (no se confía en clubId/courtId del cliente). El
 * court_block lo escribe el trigger tournament_matches_sync_court_block en la
 * misma transacción del update, así no pueden quedar desincronizados.
 */
const ASSIGN_SLOT_REASON_MESSAGES: Record<string, string> = {
  match_not_found: "Partido no encontrado.",
  forbidden: "No autorizado.",
  tournament_not_editable: "El torneo ya no admite cambios de horario.",
  match_finished: "No se puede reprogramar un partido finalizado.",
  invalid_court: "Cancha inválida.",
  court_closed: "El club está cerrado ese día.",
  invalid_time: "Ese horario está fuera del horario de apertura de la cancha.",
  reservation_conflict: "Ese horario ya tiene una reserva.",
  fixed_booking_conflict: "Ese horario está ocupado por un turno fijo.",
  training_conflict: "Ese horario está ocupado por un entrenamiento.",
  tournament_match_conflict: "Ese horario ya está ocupado por otro partido.",
  reservation_hold_conflict: "Hay una reserva en proceso de pago para ese horario.",
};

/**
 * Asigna cancha/fecha/hora a un partido de torneo (legacy de una sola
 * categoría o cualquier partido V2 de zona/cuadro: la RPC no distingue).
 * Toda la validación (torneo/partido editable, cancha del club, horario de
 * apertura, conflicto con reservas/turnos fijos/entrenamientos/otros
 * partidos) y el UPDATE viven en una sola transacción del lado de la base
 * (tournament_assign_match_slot, Fase D) para no dejar ventana entre
 * "leer disponibilidad" y "escribir". El respaldo duro contra otro partido
 * de torneo concurrente es el índice único de producción
 * court_blocks_court_date_time_key.
 */
export async function assignTournamentMatchSlot(input: {
  matchId: string;
  courtId: string;
  matchDate: string;
  matchTime: string;
  clubId: string;
  tournamentId: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.matchDate) ||
    !/^\d{2}:\d{2}$/.test(input.matchTime)
  ) {
    return { ok: false, error: "Fecha u hora inválida." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const { data, error } = await supabase.rpc("tournament_assign_match_slot", {
    p_match_id: input.matchId,
    p_court_id: input.courtId,
    p_date: input.matchDate,
    p_time: input.matchTime,
  });
  if (error) return { ok: false, error: "No se pudo asignar el horario." };
  const row = (Array.isArray(data) ? data[0] : data) as { ok: boolean; reason: string } | null;
  if (!row?.ok) {
    return { ok: false, error: ASSIGN_SLOT_REASON_MESSAGES[row?.reason ?? ""] ?? "No se pudo asignar el horario." };
  }

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
  const pairIds = [pair1Id, pair2Id].filter((id): id is string => Boolean(id));
  if (pairIds.length > 0) {
    const { count } = await service
      .from(DB_TABLES.tournamentRegistrations)
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)
      .in("id", pairIds);
    if ((count ?? 0) !== new Set(pairIds).size) {
      return { ok: false, message: "Pareja inválida." };
    }
  }

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
