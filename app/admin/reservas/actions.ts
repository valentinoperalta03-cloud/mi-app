"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";

export type ManualBlockState = { success: boolean; message: string };

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createManualCourtBlockAction(
  _prev: ManualBlockState,
  formData: FormData
): Promise<ManualBlockState> {
  const courtId = getField(formData, "court_id");
  const date = getField(formData, "date");
  const startTime = getField(formData, "start_time");

  if (!courtId || !date || !startTime) {
    return { success: false, message: "Completa cancha, fecha y hora." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    return { success: false, message: "Sesion invalida." };
  }
  if (!ctx.courtIds.includes(courtId)) {
    return { success: false, message: "La cancha no pertenece a tu club." };
  }

  const { error } = await supabase.from(DB_TABLES.courtBlocks).insert({
    court_id: courtId,
    date,
    start_time: startTime.length >= 5 ? startTime.slice(0, 5) : startTime,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/admin/reservas");
  revalidatePath("/club/gestion");
  return { success: true, message: "Bloqueo creado." };
}
