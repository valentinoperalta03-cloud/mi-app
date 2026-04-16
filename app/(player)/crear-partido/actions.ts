"use server";

import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export type CreateWizardMatchState = {
  success: boolean;
  message: string;
  matchId?: string;
};

const initialState: CreateWizardMatchState = { success: false, message: "" };

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/** CHECK en DB: solo `amistoso` | `competitivo` (minúsculas). */
function normalizeMatchType(raw: string): "amistoso" | "competitivo" {
  const v = raw.toLowerCase().trim();
  return v === "competitivo" ? "competitivo" : "amistoso";
}

/** CHECK en DB: solo `publico` | `privado` (español, minúsculas). */
function normalizeVisibility(raw: string): "publico" | "privado" {
  const v = raw.toLowerCase().trim();
  if (v === "privado") return "privado";
  if (v === "publico") return "publico";
  return "publico";
}

function normalizeGenderCategory(raw: string): "masculino" | "femenino" | "mixto" {
  const v = raw.toLowerCase().trim();
  if (v === "femenino") return "femenino";
  if (v === "mixto") return "mixto";
  return "masculino";
}

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

export async function createWizardMatchAction(
  prevState: CreateWizardMatchState = initialState,
  formData: FormData
): Promise<CreateWizardMatchState> {
  void prevState;
  const clubId = getField(formData, "club_id");
  const courtId = getField(formData, "court_id");
  const locationName = getField(formData, "location_name");
  const scheduledDate = getField(formData, "scheduled_date");
  const scheduledTime = getField(formData, "scheduled_time");
  const matchType = normalizeMatchType(getField(formData, "match_type"));
  const visibility = normalizeVisibility(getField(formData, "visibility"));
  const genderCategory = normalizeGenderCategory(getField(formData, "gender_category"));

  if (!clubId || !courtId || !scheduledDate || !scheduledTime) {
    return { success: false, message: "Completa ubicación, fecha, horario y cancha." };
  }

  const scheduledIso = toIso(scheduledDate, scheduledTime);
  if (Number.isNaN(new Date(scheduledIso).getTime())) {
    return { success: false, message: "Fecha u horario inválido." };
  }

  const now = new Date();
  if (new Date(scheduledIso) < now) {
    return { success: false, message: "Selecciona un horario futuro." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Necesitas iniciar sesión para crear el partido." };
  }

  const { data: courtRow, error: courtError } = await supabase
    .from(DB_TABLES.courts)
    .select("id, club_id")
    .eq("id", courtId)
    .maybeSingle();
  if (courtError || !courtRow || courtRow.club_id !== clubId) {
    return { success: false, message: "La cancha seleccionada no coincide con el club." };
  }

  const payload = {
    court_id: courtId,
    date: scheduledIso,
    is_competitive: matchType === "competitivo",
    match_type: matchType,
    visibility,
    gender_category: genderCategory,
    court_status: "app_booking",
    location_name: locationName || "Rosario",
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
    owner_id: user.id,
  };

  const { data: match, error: insertError } = await supabase
    .from(DB_TABLES.matches)
    .insert(payload)
    .select("id")
    .single();

  if (insertError || !match) {
    return {
      success: false,
      message: `No se pudo crear el partido: ${insertError?.message ?? "error desconocido"}`,
    };
  }

  const { error: playerError } = await supabase.from(DB_TABLES.matchParticipants).insert({
    match_id: match.id,
    player_id: user.id,
  });
  if (playerError) {
    return {
      success: false,
      message: `Partido creado, pero no pudimos anotarte: ${playerError.message}`,
    };
  }

  return {
    success: true,
    message: "Partido creado con éxito.",
    matchId: match.id,
  };
}
