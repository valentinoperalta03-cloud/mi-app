"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export type ScheduleActionState = {
  success: boolean;
  message: string;
};

const initialState: ScheduleActionState = { success: false, message: "" };

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function upsertCourtScheduleAction(
  prevState: ScheduleActionState = initialState,
  formData: FormData
): Promise<ScheduleActionState> {
  void prevState;

  const courtId = getField(formData, "court_id");
  const dayRaw = getField(formData, "day_of_week");
  const openTime = getField(formData, "open_time");
  const closeTime = getField(formData, "close_time");

  if (!courtId || !dayRaw || !openTime || !closeTime) {
    return { success: false, message: "Completa apertura y cierre para guardar." };
  }

  const dayOfWeek = Number(dayRaw);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { success: false, message: "El dia debe estar entre 0 y 6." };
  }
  if (openTime >= closeTime) {
    return { success: false, message: "La apertura debe ser anterior al cierre." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    redirect("/login");
  }
  if (!ctx.courtIds.includes(courtId)) {
    return {
      success: false,
      message: "No tienes permiso para editar horarios de esta cancha.",
    };
  }

  const { error } = await supabase.from(DB_TABLES.courtSchedules).upsert(
    {
      court_id: courtId,
      day_of_week: dayOfWeek,
      open_time: openTime,
      close_time: closeTime,
    },
    { onConflict: "court_id,day_of_week" }
  );

  if (error) {
    return { success: false, message: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/club/horarios");
  return { success: true, message: "Horario guardado." };
}
