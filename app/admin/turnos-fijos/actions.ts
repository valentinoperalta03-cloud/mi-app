"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNotification } from "@/lib/notifications";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { generateMatchForSlotOnDate, getUpcomingDatesForDayOfWeek } from "@/lib/fixed-slot-generator";
import { createClient, createServiceClient } from "@/utils/supabase/server";

function getArgentinaNow(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return new Date(`${y}-${m}-${d}T12:00:00`);
}

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function enc(msg: string) {
  return encodeURIComponent(msg);
}

export async function saveFixedSlotSettings(formData: FormData): Promise<void> {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length) redirect("/admin/turnos-fijos");

  const clubId = ctx.clubIds[0];
  const hoursRaw = getField(formData, "fixed_slot_confirmation_hours");
  const hours = Number(hoursRaw);

  if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
    redirect(`/admin/turnos-fijos?fixed_error=${enc("Ingresá una cantidad válida de horas (1–168).")}`);
  }

  const { error } = await supabase
    .from(DB_TABLES.clubs)
    .update({ fixed_slot_confirmation_hours: hours })
    .eq("id", clubId)
    .eq("owner_id", ctx.userId);

  if (error) {
    redirect(`/admin/turnos-fijos?fixed_error=${enc(error.message)}`);
  }

  revalidatePath("/admin/turnos-fijos");
  redirect("/admin/turnos-fijos?fixed_saved=1");
}

export async function createFixedSlot(formData: FormData) {
  const courtId = getField(formData, "court_id");
  const dayOfWeek = Number(getField(formData, "day_of_week"));
  const startTime = getField(formData, "start_time");
  const durationMinutes = Number(getField(formData, "duration_minutes") || "90");
  const playersPayload = getField(formData, "players_payload");

  if (!courtId || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !startTime) {
    return { error: "Completá cancha, día y horario." };
  }

  let players: Array<{ playerId: string }> = [];
  try {
    const parsed = JSON.parse(playersPayload) as Array<{ playerId: string }>;
    players = parsed
      .filter((p) => p?.playerId)
      .slice(0, 4)
      .map((p) => ({
        playerId: String(p.playerId),
      }));
  } catch {
    return { error: "Jugadores inválidos." };
  }
  if (players.length === 0) {
    return { error: "Seleccioná al menos un jugador." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  const court = ctx.courts.find((c) => c.id === courtId);
  if (!court) return { error: "La cancha no pertenece a tu club." };

  const { data: inserted, error: slotErr } = await supabase
    .from(DB_TABLES.fixedSlots)
    .insert({
      club_id: court.club_id,
      court_id: courtId,
      day_of_week: dayOfWeek,
      start_time: startTime.slice(0, 5),
      duration_minutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 90,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (slotErr || !inserted) {
    return { error: "No se pudo crear el turno fijo." };
  }

  const fixedSlotId = String((inserted as { id: string }).id);
  const { error: playersErr } = await supabase.from(DB_TABLES.fixedSlotPlayers).insert(
    players.map((p) => ({
      fixed_slot_id: fixedSlotId,
      player_id: p.playerId,
    }))
  );
  if (playersErr) {
    await supabase.from(DB_TABLES.fixedSlots).delete().eq("id", fixedSlotId);
    return { error: "No se pudieron asignar los jugadores." };
  }

  await Promise.all(
    players.map((p) =>
      createNotification(supabase, {
        user_id: p.playerId,
        type: "join_request",
        title: "Te asignaron un turno fijo",
        body: `El club te asignó un turno fijo los ${DAY_LABELS[dayOfWeek]} a las ${startTime.slice(0, 5)} en ${court.name ?? "Cancha"}. Confirmás desde tu app cada semana.`,
      })
    )
  );

  // Generar partidos para las próximas 2 semanas inmediatamente
  const serviceSupabase = createServiceClient();
  const upcomingDates = getUpcomingDatesForDayOfWeek(dayOfWeek, getArgentinaNow(), 14);
  for (const date of upcomingDates) {
    await generateMatchForSlotOnDate(serviceSupabase, {
      id: fixedSlotId,
      club_id: court.club_id,
      court_id: courtId,
      start_time: startTime,
      duration_minutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 90,
    }, date);
  }

  revalidatePath("/admin/turnos-fijos");
  return { ok: true };
}

export async function deleteFixedSlot(formData: FormData) {
  const fixedSlotId = getField(formData, "fixed_slot_id");
  if (!fixedSlotId) return;

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: slot } = await supabase
    .from(DB_TABLES.fixedSlots)
    .select("id,court_id")
    .eq("id", fixedSlotId)
    .maybeSingle();
  const courtId = String((slot as { court_id?: string } | null)?.court_id ?? "");
  if (!courtId || !ctx.courtIds.includes(courtId)) return;

  await supabase.from(DB_TABLES.fixedSlots).update({ is_active: false }).eq("id", fixedSlotId);

  // Cancelar partidos futuros — usar serviceClient para bypasear RLS,
  // ya que el owner_id de los matches es un jugador, no el admin.
  const serviceSupabase = createServiceClient();
  const today = getArgentinaNow().toISOString().slice(0, 10);
  const { data: futureMatches } = await serviceSupabase
    .from(DB_TABLES.matches)
    .select("id")
    .eq("fixed_slot_id", fixedSlotId)
    .eq("es_turno_fijo", true)
    .neq("match_status", "cancelled")
    .gte("scheduled_date", today);

  const matchIds = ((futureMatches ?? []) as Array<{ id: string }>).map((m) => m.id);
  if (matchIds.length > 0) {
    await serviceSupabase
      .from(DB_TABLES.matches)
      .update({ match_status: "cancelled" })
      .in("id", matchIds);

    // Notificar a los participantes de cada partido cancelado
    const { data: participants } = await serviceSupabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id, match_id")
      .in("match_id", matchIds);

    for (const p of (participants ?? []) as Array<{ player_id: string; match_id: string }>) {
      await createNotification(serviceSupabase, {
        user_id: p.player_id,
        type: "reservation_cancelled",
        title: "Turno fijo cancelado",
        body: "El club desactivó este turno fijo. Los partidos pendientes fueron cancelados.",
        match_id: p.match_id,
      });
    }
  }

  revalidatePath("/admin/turnos-fijos");
}

export async function addExceptionToFixedSlot(formData: FormData): Promise<void> {
  const fixedSlotId = getField(formData, "fixed_slot_id");
  const exceptionDate = getField(formData, "exception_date");
  const reason = getField(formData, "reason");
  if (!fixedSlotId || !exceptionDate) return;

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: slot } = await supabase
    .from(DB_TABLES.fixedSlots)
    .select("id,court_id,start_time")
    .eq("id", fixedSlotId)
    .maybeSingle();
  const typedSlot = slot as { id: string; court_id: string; start_time: string } | null;
  if (!typedSlot || !ctx.courtIds.includes(typedSlot.court_id)) return;

  const { error } = await supabase.from(DB_TABLES.fixedSlotExceptions).insert({
    fixed_slot_id: fixedSlotId,
    exception_date: exceptionDate,
    reason: reason || null,
    cancelled_by: ctx.userId,
  });
  if (error) return;

  const slotTime = String(typedSlot.start_time).slice(0, 5);

  // Cancelar el partido ya generado para esa fecha y liberar el horario
  const { data: existingMatch } = await supabase
    .from(DB_TABLES.matches)
    .select("id")
    .eq("fixed_slot_id", fixedSlotId)
    .eq("scheduled_date", exceptionDate)
    .eq("es_turno_fijo", true)
    .neq("match_status", "cancelled")
    .maybeSingle();

  if (existingMatch) {
    const matchId = String((existingMatch as { id: string }).id);
    await supabase
      .from(DB_TABLES.matches)
      .update({ match_status: "cancelled" })
      .eq("id", matchId);

    const { data: matchParticipants } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id")
      .eq("match_id", matchId);

    for (const p of (matchParticipants ?? []) as Array<{ player_id: string }>) {
      await createNotification(supabase, {
        user_id: p.player_id,
        type: "reservation_cancelled",
        title: "Turno fijo cancelado",
        body: `El club canceló el turno del ${exceptionDate} a las ${slotTime}. El horario quedó libre.`,
        match_id: matchId,
      });
    }
  } else {
    // Si no había partido generado, igual notificamos por las dudas
    const { data: players } = await supabase
      .from(DB_TABLES.fixedSlotPlayers)
      .select("player_id")
      .eq("fixed_slot_id", fixedSlotId);
    for (const p of (players ?? []) as Array<{ player_id: string }>) {
      await createNotification(supabase, {
        user_id: p.player_id,
        type: "reservation_cancelled",
        title: "Turno fijo cancelado",
        body: `El club canceló el turno del ${exceptionDate} a las ${slotTime}.`,
      });
    }
  }

  revalidatePath("/admin/turnos-fijos");
}

export async function addPlayerToFixedSlot(formData: FormData): Promise<void> {
  const fixedSlotId = getField(formData, "fixed_slot_id");
  const playerId = getField(formData, "player_id");
  if (!fixedSlotId || !playerId) return;

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: slot } = await supabase
    .from(DB_TABLES.fixedSlots)
    .select("id,court_id")
    .eq("id", fixedSlotId)
    .maybeSingle();
  const typedSlot = slot as { id: string; court_id: string } | null;
  if (!typedSlot || !ctx.courtIds.includes(typedSlot.court_id)) return;

  const { count } = await supabase
    .from(DB_TABLES.fixedSlotPlayers)
    .select("id", { count: "exact", head: true })
    .eq("fixed_slot_id", fixedSlotId);
  if ((count ?? 0) >= 4) return;

  const { error } = await supabase.from(DB_TABLES.fixedSlotPlayers).insert({
    fixed_slot_id: fixedSlotId,
    player_id: playerId,
  });
  if (error && error.code !== "23505") return;

  // Agregar al jugador a los partidos futuros ya generados
  const today = getArgentinaNow().toISOString().slice(0, 10);
  const { data: futureMatches } = await supabase
    .from(DB_TABLES.matches)
    .select("id")
    .eq("fixed_slot_id", fixedSlotId)
    .eq("es_turno_fijo", true)
    .neq("match_status", "cancelled")
    .gte("scheduled_date", today);

  for (const match of (futureMatches ?? []) as Array<{ id: string }>) {
    const { data: alreadyIn } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id")
      .eq("match_id", match.id)
      .eq("player_id", playerId)
      .maybeSingle();
    if (alreadyIn) continue;

    const { count } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id", { count: "exact", head: true })
      .eq("match_id", match.id);
    if ((count ?? 0) >= 4) continue;

    await supabase.from(DB_TABLES.matchParticipants).insert({
      match_id: match.id,
      player_id: playerId,
    });
    await supabase.from(DB_TABLES.payments).insert({
      match_id: match.id,
      user_id: playerId,
      status: "invited",
      amount: 0,
      marketplace_fee: 0,
    });
  }

  await createNotification(supabase, {
    user_id: playerId,
    type: "join_request",
    title: "Te agregaron a un turno fijo",
    body: "El club te agregó a un turno fijo. Revisá tu próxima confirmación en la app.",
  });

  revalidatePath("/admin/turnos-fijos");
}

export async function removeException(formData: FormData): Promise<void> {
  const exceptionId = getField(formData, "exception_id");
  if (!exceptionId) return;

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: exceptionRow } = await supabase
    .from(DB_TABLES.fixedSlotExceptions)
    .select("id,fixed_slot_id,exception_date")
    .eq("id", exceptionId)
    .maybeSingle();
  const exception = exceptionRow as { id: string; fixed_slot_id: string; exception_date: string } | null;
  if (!exception) return;

  const { data: slot } = await supabase
    .from(DB_TABLES.fixedSlots)
    .select("id,court_id,club_id,start_time,duration_minutes")
    .eq("id", exception.fixed_slot_id)
    .maybeSingle();
  const typedSlot = slot as {
    id: string;
    court_id: string;
    club_id: string;
    start_time: string;
    duration_minutes: number;
  } | null;
  if (!typedSlot || !ctx.courtIds.includes(typedSlot.court_id)) return;

  await supabase.from(DB_TABLES.fixedSlotExceptions).delete().eq("id", exceptionId);

  // Regenerar el partido para esa fecha ahora que la excepción ya no existe
  const serviceSupabase = createServiceClient();
  await generateMatchForSlotOnDate(serviceSupabase, {
    id: typedSlot.id,
    club_id: typedSlot.club_id,
    court_id: typedSlot.court_id,
    start_time: typedSlot.start_time,
    duration_minutes: typedSlot.duration_minutes,
  }, exception.exception_date);

  revalidatePath("/admin/turnos-fijos");
}

export async function removePlayerFromFixedSlot(formData: FormData): Promise<void> {
  const fixedSlotId = getField(formData, "fixed_slot_id");
  const playerId = getField(formData, "player_id");
  if (!fixedSlotId || !playerId) return;

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: slot } = await supabase
    .from(DB_TABLES.fixedSlots)
    .select("id,court_id")
    .eq("id", fixedSlotId)
    .maybeSingle();
  const typedSlot = slot as { id: string; court_id: string } | null;
  if (!typedSlot || !ctx.courtIds.includes(typedSlot.court_id)) return;

  await supabase
    .from(DB_TABLES.fixedSlotPlayers)
    .delete()
    .eq("fixed_slot_id", fixedSlotId)
    .eq("player_id", playerId);

  // Remover de los partidos futuros generados
  const today = getArgentinaNow().toISOString().slice(0, 10);
  const { data: futureMatches } = await supabase
    .from(DB_TABLES.matches)
    .select("id")
    .eq("fixed_slot_id", fixedSlotId)
    .eq("es_turno_fijo", true)
    .neq("match_status", "cancelled")
    .gte("scheduled_date", today);

  for (const match of (futureMatches ?? []) as Array<{ id: string }>) {
    await supabase
      .from(DB_TABLES.matchParticipants)
      .delete()
      .eq("match_id", match.id)
      .eq("player_id", playerId);
    await supabase
      .from(DB_TABLES.payments)
      .delete()
      .eq("match_id", match.id)
      .eq("user_id", playerId);
  }

  await createNotification(supabase, {
    user_id: playerId,
    type: "reservation_cancelled",
    title: "Te removieron del turno fijo",
    body: "El club te quitó de un turno fijo.",
  });

  revalidatePath("/admin/turnos-fijos");
}
