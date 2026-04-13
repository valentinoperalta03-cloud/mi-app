"use server";

import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export type CreateMatchActionState = {
  success: boolean;
  message: string;
};

const initialState: CreateMatchActionState = { success: false, message: "" };

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function combineDateTimeToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

export async function createMatchAction(
  prevState: CreateMatchActionState = initialState,
  formData: FormData
): Promise<CreateMatchActionState> {
  void prevState;

  const clubId = getField(formData, "club_id");
  const courtId = getField(formData, "court_id");
  const matchDate = getField(formData, "match_date");
  const matchTime = getField(formData, "match_time");
  const isCompetitive = formData.get("is_competitive") === "on";

  if (!clubId || !courtId || !matchDate || !matchTime) {
    return { success: false, message: "Completa club, cancha, fecha y hora." };
  }

  const selectedDay = new Date(`${matchDate}T00:00:00`);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (selectedDay < todayStart) {
    return { success: false, message: "La fecha debe ser hoy o futura." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, message: "Necesitas iniciar sesion para crear partidos." };
  }

  const { data: courtRow, error: courtError } = await supabase
    .from(DB_TABLES.courts)
    .select("id, club_id")
    .eq("id", courtId)
    .maybeSingle();

  if (courtError || !courtRow) {
    return { success: false, message: "La cancha seleccionada no existe." };
  }

  if (courtRow.club_id !== clubId) {
    return {
      success: false,
      message: "La cancha no pertenece al club seleccionado.",
    };
  }

  const dateIso = combineDateTimeToIso(matchDate, matchTime);
  const now = new Date();
  if (new Date(dateIso) < now) {
    return {
      success: false,
      message: "La fecha y hora deben ser actuales o futuras.",
    };
  }

  const { data: match, error: matchError } = await supabase
    .from(DB_TABLES.matches)
    .insert({
      court_id: courtId,
      created_by: user.id,
      date: dateIso,
      is_competitive: isCompetitive,
    })
    .select("id")
    .single();

  if (matchError || !match) {
    return {
      success: false,
      message: `No se pudo crear el partido: ${matchError?.message ?? "error desconocido"}`,
    };
  }

  const { error: playerError } = await supabase.from(DB_TABLES.matchPlayers).insert({
    match_id: match.id,
    player_id: user.id,
  });

  if (playerError) {
    return {
      success: false,
      message: `Partido creado, pero no pudimos inscribirte: ${playerError.message}`,
    };
  }

  const params = new URLSearchParams({
    kind: "success",
    message: "Partido creado con exito. Ya estas anotado.",
  });
  redirect(`/buscar-partido?${params.toString()}`);
}
