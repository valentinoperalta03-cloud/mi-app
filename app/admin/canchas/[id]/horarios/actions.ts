"use server";

import { revalidatePath } from "next/cache";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { parseClockToMinutes } from "@/lib/court-slots";
import { createClient } from "@/utils/supabase/server";

export type CourtTimeRangeState = { ok: boolean; message?: string };

export async function addCourtTimeRange(
  courtId: string,
  dayOfWeek: number,
  openTime: string,
  closeTime: string
): Promise<CourtTimeRangeState> {
  if (!courtId || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !openTime || !closeTime) {
    return { ok: false, message: "Datos inválidos." };
  }
  const open = openTime.slice(0, 5);
  const close = closeTime.slice(0, 5);
  const openMin = parseClockToMinutes(open);
  const closeMin = parseClockToMinutes(close);
  if (closeMin <= openMin) {
    return { ok: false, message: "El horario de cierre debe ser mayor al de apertura." };
  }
  if (closeMin - openMin < 90) {
    return { ok: false, message: "La franja debe durar al menos 90 minutos." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, message: "Sesión requerida." };
  if (!ctx.courtIds.includes(courtId)) return { ok: false, message: "Cancha no autorizada." };

  const { data: existingRaw } = await supabase
    .from(DB_TABLES.courtTimeRanges)
    .select("open_time,close_time")
    .eq("court_id", courtId)
    .eq("day_of_week", dayOfWeek);
  const existing = (existingRaw ?? []) as Array<{ open_time: string; close_time: string }>;
  const overlaps = existing.some((r) => {
    const rOpen = parseClockToMinutes(String(r.open_time).slice(0, 5));
    const rClose = parseClockToMinutes(String(r.close_time).slice(0, 5));
    return openMin < rClose && closeMin > rOpen;
  });
  if (overlaps) return { ok: false, message: "La franja se superpone con otra ya cargada." };

  const { error } = await supabase.from(DB_TABLES.courtTimeRanges).insert({
    court_id: courtId,
    day_of_week: dayOfWeek,
    open_time: open,
    close_time: close,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/canchas/${courtId}/horarios`);
  return { ok: true };
}

export async function removeCourtTimeRange(rangeId: string): Promise<CourtTimeRangeState> {
  if (!rangeId) return { ok: false, message: "Franja inválida." };

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, message: "Sesión requerida." };

  const { data: row } = await supabase
    .from(DB_TABLES.courtTimeRanges)
    .select("id,court_id")
    .eq("id", rangeId)
    .maybeSingle();
  const range = row as { id: string; court_id: string } | null;
  if (!range || !ctx.courtIds.includes(range.court_id)) {
    return { ok: false, message: "Franja no encontrada." };
  }

  const { error } = await supabase.from(DB_TABLES.courtTimeRanges).delete().eq("id", rangeId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/canchas/${range.court_id}/horarios`);
  return { ok: true };
}
