"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createGroupChat } from "@/lib/group-chats";
import { createNotification } from "@/lib/notifications";
import { PROFILE_CATEGORIES } from "@/lib/profile-display";
import { propagateBracket } from "@/lib/tournament-match-result";
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
import { pickMatchFormat, resolveTournamentFormats, type MatchPhaseForFormat } from "@/lib/tournament/v2/match-format";
import { validateMatchResult, type ResultInput, type SetScoreInput } from "@/lib/tournament/v2/results";
import type { CompetitionPhase } from "@/lib/tournament/v2/types";
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

  if (!["americano", "pena", "eliminacion", "zonas"].includes(ttype)) {
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

    if (ttype === "zonas") {
      // El fixture de "zonas" NO se arma acá: cada categoría genera sus
      // propias zonas y partidos de zona desde el Centro de Torneo
      // (generateZonesAction / generateZoneMatchesAction en
      // categories-actions.ts / competitive-actions.ts), recién una vez que
      // el admin decide cuántas zonas armar con las inscripciones
      // confirmadas. Acá solo se valida que haya suficientes inscriptos.
      continue;
    }

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

  // "Zonas" no arma su fixture al iniciar (ver startTournamentAction): el
  // chequeo de arriba solo mira partidos ya creados, así que una categoría
  // cuyas zonas terminaron pero nunca generó clasificados/cuadro pasaría el
  // chequeo sin tener campeón. Se bloquea explícitamente hasta que cada
  // categoría con zonas generadas tenga también su cuadro armado.
  if (tournamentType === "zonas") {
    const { data: cats } = await service
      .from(DB_TABLES.tournamentCategories)
      .select("id, name, zones_generated_at, qualifiers_generated_at")
      .eq("tournament_id", tournamentId);
    const incomplete = ((cats ?? []) as Array<{
      id: string;
      name: string;
      zones_generated_at: string | null;
      qualifiers_generated_at: string | null;
    }>).filter((c) => c.zones_generated_at && !c.qualifiers_generated_at);
    if (incomplete.length > 0) {
      return {
        ok: false,
        message: `Faltan clasificados/cuadro en: ${incomplete.map((c) => c.name).join(", ")}.`,
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

/**
 * Carga/corrige el resultado de un partido de americano o eliminación
 * (peñas no cargan resultados; zonas usa saveMatchResultAction en
 * competitive-actions.ts). Reusa validateMatchResult (reglas reales de
 * pádel: sets, tie-break, super tie-break) y la misma RPC
 * tournament_apply_match_result_v2 que ya usa el camino V2 — así ambos
 * caminos comparten la misma validación deportiva y el mismo bloqueo de
 * corrección retroactiva (no se puede pisar un resultado si la ronda
 * siguiente ya arrancó).
 *
 * Contrato de formData: `kind` = "sets" | "timed".
 * - sets: `sets_json` = JSON de [{p1,p2}, ...].
 * - timed: `games1`, `games2`, `tiebreak_winner` ("1" | "2", opcional).
 */
export async function saveTournamentMatchAction(
  tournamentId: string,
  matchId: string,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;

  const ttype = (gate.row as { tournament_type?: string }).tournament_type;
  if (ttype === "pena") {
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

  const kind = String(formData.get("kind") ?? "sets");
  let input: ResultInput;
  if (kind === "timed") {
    const games1 = Number(formData.get("games1"));
    const games2 = Number(formData.get("games2"));
    const tbRaw = String(formData.get("tiebreak_winner") ?? "").trim();
    const tiebreakWinner = tbRaw === "1" || tbRaw === "2" ? (Number(tbRaw) as 1 | 2) : null;
    input = { kind: "timed", games1, games2, tiebreakWinner };
  } else {
    const setsRaw = String(formData.get("sets_json") ?? "[]").trim();
    let sets: SetScoreInput[];
    try {
      sets = JSON.parse(setsRaw) as SetScoreInput[];
    } catch {
      return { ok: false, message: "JSON de sets inválido." };
    }
    input = { kind: "sets", sets };
  }

  const service = createServiceClient();

  const { data: existing } = await service
    .from(DB_TABLES.tournamentMatches)
    .select("pair1_id, pair2_id, status, winner_pair_id, category_id, phase, round")
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
    phase: string | null;
    round: number;
  } | null;
  if (!em?.pair1_id || !em.pair2_id) {
    return { ok: false, message: "Faltan parejas en el partido." };
  }

  const dbPhase = em.phase ?? (ttype === "eliminacion" ? "knockout" : "americano");
  let isFinal = false;
  if (dbPhase === "knockout" && em.category_id) {
    const { data: maxRow } = await service
      .from(DB_TABLES.tournamentMatches)
      .select("round")
      .eq("category_id", em.category_id)
      .eq("phase", "knockout")
      .order("round", { ascending: false })
      .limit(1)
      .maybeSingle();
    isFinal = (maxRow as { round?: number } | null)?.round === em.round;
  }

  const { data: tRow } = await service
    .from(DB_TABLES.tournaments)
    .select("match_formats, match_format, match_duration_minutes")
    .eq("id", tournamentId)
    .maybeSingle();
  const tour = tRow as { match_formats: unknown; match_format: string | null; match_duration_minutes: number | null } | null;
  const formats = resolveTournamentFormats(tour?.match_formats, tour?.match_format, tour?.match_duration_minutes);
  const format = pickMatchFormat(formats, dbPhase as MatchPhaseForFormat, isFinal);
  const phaseForValidation: CompetitionPhase = dbPhase === "americano" ? "americano" : "knockout";
  const validation = validateMatchResult(format, phaseForValidation, input);
  if (!validation.ok) return { ok: false, message: validation.message };
  const result = validation.result;

  const RESULT_REASON_MESSAGES: Record<string, string> = {
    match_not_found: "Partido no encontrado.",
    forbidden: "No autorizado.",
    missing_pairs: "Faltan parejas en el partido.",
    invalid_outcome: "Resultado inválido.",
    qualifiers_already_generated: "No se puede corregir: ya se generaron los clasificados.",
    next_round_started: "La pareja que ganó este partido ya jugó la siguiente ronda: no se puede corregir el resultado.",
    draw_not_allowed: "En esta fase no puede haber empate.",
  };

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
  const rpcRes = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as
    | { ok: boolean; reason: string; winner_pair_id: string | null; phase: string | null }
    | null;
  if (!rpcRes?.ok) {
    return { ok: false, message: RESULT_REASON_MESSAGES[rpcRes?.reason ?? ""] ?? "No se pudo guardar el resultado." };
  }

  if (rpcRes.phase === "knockout" && rpcRes.winner_pair_id && em.winner_pair_id !== rpcRes.winner_pair_id) {
    await propagateBracket(service, matchId, rpcRes.winner_pair_id);
  }

  const res: { ok: boolean; message: string } = { ok: true, message: "Resultado guardado." };

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
  pair_conflict: "Una de las parejas ya tiene otro partido asignado a esa hora.",
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

export type TournamentSlot = { date: string; courtId: string; time: string };

/**
 * Disponibilidad deportiva del torneo (secciones 4.4/11): pool de
 * canchas+día+franja que el club destinó al torneo. Editable después de
 * creado — necesario para "zonas", donde el club recién sabe cuánta cancha
 * hace falta al cerrar inscripciones, mucho después de haber creado el
 * torneo desde el wizard.
 */
export async function updateTournamentAvailabilityAction(
  tournamentId: string,
  slots: TournamentSlot[],
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return gate;
  const status = (gate.row as { status?: string }).status;
  if (status === "finished" || status === "cancelled") {
    return { ok: false, message: "El torneo ya no admite cambios de disponibilidad." };
  }
  if (
    !Array.isArray(slots) ||
    !slots.every(
      (s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date) && /^[0-9a-f-]{36}$/i.test(s.courtId) && /^\d{2}:\d{2}$/.test(s.time),
    )
  ) {
    return { ok: false, message: "Franjas inválidas." };
  }

  const service = createServiceClient();
  const { error } = await service
    .from(DB_TABLES.tournaments)
    .update({ tournament_court_blocks: slots })
    .eq("id", tournamentId);
  if (error) return { ok: false, message: "No se pudo guardar la disponibilidad." };

  revalidatePath(`/admin/torneos/${tournamentId}`);
  return { ok: true, message: `Disponibilidad guardada: ${slots.length} franja${slots.length === 1 ? "" : "s"}.` };
}

type UnscheduledMatch = { label: string; reason: string };

/**
 * "Generar programación" (sección 11): asigna automáticamente TODOS los
 * partidos con ambas parejas ya definidas y sin horario todavía, usando el
 * pool de `tournament_court_blocks` como candidatos. Reutiliza tal cual
 * `tournament_assign_match_slot` (misma RPC, mismos locks, misma
 * revalidación server-side) para cada asignación — esta función NO decide
 * si un horario es válido, eso lo sigue decidiendo la RPC; solo itera
 * candidatos y evita, del lado de la app, lo único que la RPC no puede ver
 * por sí sola: que una MISMA pareja no puede jugar dos partidos a la vez en
 * dos canchas distintas (la RPC valida por cancha, no por pareja).
 * No reimplementa el motor de fixtures ni de disponibilidad: son datos ya
 * persistidos (tournament_matches, tournament_court_blocks).
 */
export async function autoScheduleTournamentAction(
  tournamentId: string,
): Promise<{ ok: boolean; message: string; scheduled: number; unscheduled: UnscheduledMatch[] }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertTournamentOwner(supabase, tournamentId);
  if (!gate.ok) return { ...gate, scheduled: 0, unscheduled: [] };

  const row = gate.row as { status?: string; club_id?: string };
  if (row.status !== "in_progress") {
    return { ok: false, message: "Solo se puede programar un torneo en curso.", scheduled: 0, unscheduled: [] };
  }
  const clubId = String(row.club_id ?? "");

  const service = createServiceClient();
  const { data: tRow } = await service.from(DB_TABLES.tournaments).select("tournament_court_blocks").eq("id", tournamentId).maybeSingle();
  const pool = ((tRow as { tournament_court_blocks: unknown } | null)?.tournament_court_blocks ?? []) as TournamentSlot[];
  if (!Array.isArray(pool) || pool.length === 0) {
    return {
      ok: false,
      message: "El torneo no tiene disponibilidad configurada. Agregá canchas/franjas desde \"Disponibilidad del torneo\".",
      scheduled: 0,
      unscheduled: [],
    };
  }

  const { data: allMatches } = await service
    .from(DB_TABLES.tournamentMatches)
    .select("id, phase, round, round_name, pair1_id, pair2_id, status, court_id, scheduled_date, scheduled_time")
    .eq("tournament_id", tournamentId);
  const matches = (allMatches ?? []) as Array<{
    id: string;
    phase: string | null;
    round: number;
    round_name: string | null;
    pair1_id: string | null;
    pair2_id: string | null;
    status: string;
    court_id: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
  }>;

  // Pareja ocupada por horario exacto (fecha|hora), viniendo de partidos que
  // YA tenían horario antes de correr esto — se actualiza a medida que este
  // mismo run va asignando, para no proponerle a una pareja dos partidos
  // simultáneos en canchas distintas (lo único que la RPC, por cancha, no ve).
  const pairBusy = new Map<string, Set<string>>();
  const claimedSlots = new Set<string>();
  function markBusy(pairId: string | null, date: string, time: string) {
    if (!pairId) return;
    const key = `${date}|${time}`;
    const set = pairBusy.get(pairId) ?? new Set<string>();
    set.add(key);
    pairBusy.set(pairId, set);
  }
  function isPairBusy(pairId: string | null, date: string, time: string): boolean {
    if (!pairId) return false;
    return pairBusy.get(pairId)?.has(`${date}|${time}`) ?? false;
  }

  for (const m of matches) {
    if (m.scheduled_date && m.scheduled_time) {
      markBusy(m.pair1_id, m.scheduled_date, m.scheduled_time);
      markBusy(m.pair2_id, m.scheduled_date, m.scheduled_time);
      if (m.court_id) claimedSlots.add(`${m.court_id}|${m.scheduled_date}|${m.scheduled_time}`);
    }
  }

  const toSchedule = matches
    .filter((m) => m.status !== "finished" && !m.scheduled_date && m.pair1_id && m.pair2_id)
    .sort((a, b) => {
      const rank = (m: (typeof matches)[number]) =>
        m.phase === "knockout" || m.phase === "americano_final" ? 1000 + m.round : m.round;
      return rank(a) - rank(b);
    });

  const { data: regs } = await service.from(DB_TABLES.tournamentRegistrations).select("id, player1_id, player2_id").eq("tournament_id", tournamentId);
  const regList = (regs ?? []) as Array<{ id: string; player1_id: string; player2_id: string | null }>;
  const { data: profiles } = await service.from(DB_TABLES.profiles).select("user_id, name");
  const nameByUser = new Map(((profiles ?? []) as Array<{ user_id: string; name: string | null }>).map((p) => [p.user_id, p.name]));
  function pairLabel(pairId: string | null): string {
    const reg = regList.find((r) => r.id === pairId);
    if (!reg) return "Pareja";
    const n1 = nameByUser.get(reg.player1_id) ?? "Jugador";
    const n2 = reg.player2_id ? (nameByUser.get(reg.player2_id) ?? "Jugador") : null;
    return n2 ? `${n1} / ${n2}` : n1;
  }

  const sortedPool = [...pool].sort((a, b) => (a.date + a.time + a.courtId).localeCompare(b.date + b.time + b.courtId));

  let scheduled = 0;
  const unscheduled: UnscheduledMatch[] = [];

  for (const m of toSchedule) {
    const label = `${m.round_name ?? "Partido"}: ${pairLabel(m.pair1_id)} vs ${pairLabel(m.pair2_id)}`;
    let placed = false;
    let lastReason = "No hay franjas disponibles.";
    for (const slot of sortedPool) {
      const slotKey = `${slot.courtId}|${slot.date}|${slot.time}`;
      if (claimedSlots.has(slotKey)) continue;
      if (isPairBusy(m.pair1_id, slot.date, slot.time) || isPairBusy(m.pair2_id, slot.date, slot.time)) continue;

      const res = await assignTournamentMatchSlot({
        matchId: m.id,
        courtId: slot.courtId,
        matchDate: slot.date,
        matchTime: slot.time,
        clubId,
        tournamentId,
      });
      if (res.ok) {
        claimedSlots.add(slotKey);
        markBusy(m.pair1_id, slot.date, slot.time);
        markBusy(m.pair2_id, slot.date, slot.time);
        scheduled++;
        placed = true;
        break;
      }
      // Conflicto real que esta app no conocía (reserva/turno fijo/otro
      // partido ya agendado fuera de este pool): esa franja no sirve para
      // nadie más tampoco — se descarta del pool para el resto del loop.
      claimedSlots.add(slotKey);
      lastReason = res.error ?? lastReason;
    }
    if (!placed) unscheduled.push({ label, reason: lastReason });
  }

  revalidatePath(`/admin/torneos/${tournamentId}`);
  return {
    ok: true,
    message:
      unscheduled.length === 0
        ? `${scheduled} partido${scheduled === 1 ? "" : "s"} programado${scheduled === 1 ? "" : "s"}.`
        : `${scheduled} programado${scheduled === 1 ? "" : "s"}, ${unscheduled.length} sin poder programar — agregá más disponibilidad.`,
    scheduled,
    unscheduled,
  };
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
