"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

export type ActionState = {
  success: boolean;
  message: string;
};

const initialState: ActionState = { success: false, message: "" };

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isValidUuid(value: string) {
  return uuidRegex.test(value);
}

export async function createCourtAction(
  prevState: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void prevState;
  const clubId = getField(formData, "club_id");
  const name = getField(formData, "name");
  const priceRaw = getField(formData, "price");

  if (!clubId || !name || !priceRaw) {
    return { success: false, message: "Completa todos los campos de la cancha." };
  }
  if (!isValidUuid(clubId)) {
    return { success: false, message: "club_id no es un UUID valido." };
  }

  const price = Number(priceRaw);
  if (Number.isNaN(price) || price < 0) {
    return { success: false, message: "El precio debe ser un numero positivo." };
  }

  const { error } = await supabase.from("courts").insert({
    club_id: clubId,
    name,
    price,
  });

  if (error) {
    return { success: false, message: `Error al crear cancha: ${error.message}` };
  }

  revalidatePath("/admin/gestion");
  return { success: true, message: "Cancha creada con exito." };
}

export async function upsertCourtScheduleAction(
  prevState: ActionState = initialState,
  formData: FormData
): Promise<ActionState> {
  void prevState;
  const courtId = getField(formData, "court_id");
  const dayRaw = getField(formData, "day_of_week");
  const openTime = getField(formData, "open_time");
  const closeTime = getField(formData, "close_time");

  if (!courtId || !dayRaw || !openTime || !closeTime) {
    return { success: false, message: "Completa todos los campos del horario." };
  }
  if (!isValidUuid(courtId)) {
    return { success: false, message: "court_id no es un UUID valido." };
  }

  const dayOfWeek = Number(dayRaw);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { success: false, message: "day_of_week debe estar entre 0 y 6." };
  }
  if (openTime >= closeTime) {
    return {
      success: false,
      message: "La hora de apertura debe ser menor al cierre.",
    };
  }

  const { error } = await supabase.from("court_schedules").upsert(
    {
      court_id: courtId,
      day_of_week: dayOfWeek,
      open_time: openTime,
      close_time: closeTime,
    },
    { onConflict: "court_id,day_of_week" }
  );

  if (error) {
    return {
      success: false,
      message: `Error al guardar horario: ${error.message}`,
    };
  }

  revalidatePath("/admin/gestion");
  return { success: true, message: "Horario guardado con exito." };
}
