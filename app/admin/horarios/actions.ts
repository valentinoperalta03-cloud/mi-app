"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";

export async function toggleClubScheduleBlock(
  clubId: string,
  dayOfWeek: number,
  blockedTime: string
): Promise<{ ok: boolean; blocked: boolean; error?: string }> {
  if (!clubId || dayOfWeek < 0 || dayOfWeek > 6 || !blockedTime) {
    return { ok: false, blocked: false, error: "Datos inválidos." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !ctx.clubIds.includes(clubId)) {
    return { ok: false, blocked: false, error: "Sin permiso." };
  }

  const { data: existing } = await supabase
    .from(DB_TABLES.clubScheduleBlocks)
    .select("id")
    .eq("club_id", clubId)
    .eq("day_of_week", dayOfWeek)
    .eq("blocked_time", blockedTime)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from(DB_TABLES.clubScheduleBlocks)
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, blocked: true, error: error.message };
    revalidatePath("/admin/horarios");
    return { ok: true, blocked: false };
  }

  const { error } = await supabase.from(DB_TABLES.clubScheduleBlocks).insert({
    club_id: clubId,
    day_of_week: dayOfWeek,
    blocked_time: blockedTime,
  });
  if (error) return { ok: false, blocked: false, error: error.message };
  revalidatePath("/admin/horarios");
  return { ok: true, blocked: true };
}
