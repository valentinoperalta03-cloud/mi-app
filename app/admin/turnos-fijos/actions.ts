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

export async function createFixedSlot(formData: FormData) {
  const courtId = getField(formData, "court_id");
  const dayOfWeek = Number(getField(formData, "day_of_week"));
  const startTime = getField(formData, "start_time");
  const durationMinutes = Number(getField(formData, "duration_minutes") || "90");
  const title = getField(formData, "title");
  const playersPayload = getField(formData, "players_payload");

  if (!courtId || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !startTime) {
    return { error: "Completá cancha, día y horario." };
  }
  if (!title) {
    return { error: "Ponele un título al turno." };
  }

  let players: Array<{ playerId: string }> = [];
  try {
    const parsed = JSON.parse(playersPayload || "[]") as Array<{ playerId: string }>;
    players = parsed
      .filter((p) => p?.playerId)
      .slice(0, 4)
      .map((p) => ({
        playerId: String(p.playerId),
      }));
  } catch {
    return { error: "Jugadores inválidos." };
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
      title,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (slotErr || !inserted) {
    return { error: "No se pudo crear el turno fijo." };
  }

  const fixedSlotId = String((inserted as { id: string }).id);

  if (players.length > 0) {
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
          body: `El club te asignó al turno "${title}" los ${DAY_LABELS[dayOfWeek]} a las ${startTime.slice(0, 5)} en ${court.name ?? "Cancha"}.`,
        })
      )
    );
  }

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
  revalidatePath("/admin/dashboard");
}

// Usada tanto desde la grilla de turnos fijos ("No viene esta semana", con la
// próxima fecha del día) como desde el dashboard ("No vienen hoy", con la fecha
// de hoy) — es la misma acción, solo cambia qué exception_date le pasa el caller.
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
  revalidatePath("/admin/dashboard");
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

// Botón "✓ Vinieron" del dashboard — marca a todos los jugadores del turno de
// hoy como confirmados. No tiene equivalente en la grilla (esa vista no opera
// sobre partidos de un día puntual, sino sobre la configuración recurrente).
export async function markFixedSlotAttendanceToday(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  if (!matchId) return;

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: match } = await supabase
    .from(DB_TABLES.matches)
    .select("id,court_id,es_turno_fijo")
    .eq("id", matchId)
    .maybeSingle();
  const typedMatch = match as { id: string; court_id: string; es_turno_fijo: boolean | null } | null;
  if (!typedMatch || !typedMatch.es_turno_fijo || !ctx.courtIds.includes(typedMatch.court_id)) return;

  // usar serviceClient: los match_participants pertenecen a jugadores, no al admin
  const serviceSupabase = createServiceClient();
  await serviceSupabase
    .from(DB_TABLES.matchParticipants)
    .update({ attendance_status: "confirmed" })
    .eq("match_id", matchId);

  revalidatePath("/admin/dashboard");
}
