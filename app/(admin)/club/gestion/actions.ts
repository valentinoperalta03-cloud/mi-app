"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export type BlockActionState = {
  success: boolean;
  message: string;
};

const initialState: BlockActionState = { success: false, message: "" };

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function toggleCourtBlockAction(
  prevState: BlockActionState = initialState,
  formData: FormData
): Promise<BlockActionState> {
  void prevState;

  const courtId = getField(formData, "court_id");
  const date = getField(formData, "date");
  const startTime = getField(formData, "start_time");
  const mode = getField(formData, "mode");

  if (!courtId || !date || !startTime || !mode) {
    return { success: false, message: "Faltan datos para actualizar el turno." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Debes iniciar sesion para gestionar turnos." };
  }

  const { data: courtRow, error: courtError } = await supabase
    .from(DB_TABLES.courts)
    .select("id,club_id")
    .eq("id", courtId)
    .maybeSingle();

  if (courtError || !courtRow) {
    return { success: false, message: "La cancha no existe." };
  }

  const { data: clubRow, error: clubError } = await supabase
    .from(DB_TABLES.clubs)
    .select("id")
    .eq("id", courtRow.club_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (clubError || !clubRow) {
    return { success: false, message: "No tienes permiso para gestionar esta cancha." };
  }

  if (mode === "block") {
    const { error } = await supabase.from(DB_TABLES.courtBlocks).insert({
      court_id: courtId,
      date,
      start_time: startTime,
    });
    if (error) {
      return { success: false, message: `No se pudo bloquear: ${error.message}` };
    }
  } else if (mode === "free") {
    const { error } = await supabase
      .from(DB_TABLES.courtBlocks)
      .delete()
      .eq("court_id", courtId)
      .eq("date", date)
      .eq("start_time", startTime);

    if (error) {
      return { success: false, message: `No se pudo liberar: ${error.message}` };
    }
  } else {
    return { success: false, message: "Operacion invalida." };
  }

  revalidatePath("/club/gestion");
  return { success: true, message: "Turno actualizado." };
}
