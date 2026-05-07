"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNotification } from "@/lib/notifications";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
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
      payment_method: "mp",
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

  const { data: players } = await supabase
    .from(DB_TABLES.fixedSlotPlayers)
    .select("player_id")
    .eq("fixed_slot_id", fixedSlotId);
  const playerIds = (players ?? []).map((p: { player_id: string }) => p.player_id);
  await Promise.all(
    playerIds.map((playerId) =>
      createNotification(supabase, {
        user_id: playerId,
        type: "reservation_cancelled",
        title: "Turno fijo cancelado",
        body: `El turno fijo del ${exceptionDate} a las ${String(typedSlot.start_time).slice(0, 5)} fue cancelado por el club.`,
      })
    )
  );

  revalidatePath("/admin/turnos-fijos");
}
