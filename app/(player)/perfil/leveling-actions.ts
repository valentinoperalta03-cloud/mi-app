"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import {
  computeLevelFromAnswers,
  type BaseLevelChoice,
} from "@/lib/level-quiz-logic";
import { createClient } from "@/utils/supabase/server";

export type CompleteLevelingResult = {
  ok: boolean;
  message: string;
  warnings?: { penalty: boolean; selfAssessment: boolean };
};

const HANDS = ["derecha", "izquierda"] as const;
const POSITIONS = ["drive", "reves"] as const;
const SCHEDULES = ["manana", "mediodia", "tarde", "noche"] as const;

function isBaseLevel(v: string): v is BaseLevelChoice {
  return v === "principiante" || v === "intermedio" || v === "avanzado";
}

export async function completeLevelingProfile(payload: {
  answers: number[];
  baseLevel: string;
  dominant_hand: string;
  play_position: string;
  play_schedule: string;
}): Promise<CompleteLevelingResult> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Iniciá sesión." };
  }

  const { data: prof } = await supabase
    .from(DB_TABLES.profiles)
    .select("is_leveled")
    .eq("user_id", user.id)
    .maybeSingle();

  if ((prof as { is_leveled?: boolean } | null)?.is_leveled) {
    return { ok: false, message: "Ya completaste la nivelación." };
  }

  if (!isBaseLevel(payload.baseLevel)) {
    return { ok: false, message: "Nivel inicial no válido." };
  }
  if (!HANDS.includes(payload.dominant_hand as (typeof HANDS)[number])) {
    return { ok: false, message: "Mano no válida." };
  }
  if (!POSITIONS.includes(payload.play_position as (typeof POSITIONS)[number])) {
    return { ok: false, message: "Posición no válida." };
  }
  if (!SCHEDULES.includes(payload.play_schedule as (typeof SCHEDULES)[number])) {
    return { ok: false, message: "Horario no válido." };
  }

  let comp;
  try {
    comp = computeLevelFromAnswers(payload.answers);
  } catch {
    return { ok: false, message: "El cuestionario está incompleto o es inválido." };
  }

  const scoreRounded = Math.round(comp.afterPenalty * 100) / 100;

  const { error: insErr } = await supabase.from(DB_TABLES.levelEvolution).insert({
    user_id: user.id,
    score: scoreRounded,
    category: comp.category,
    base_level: payload.baseLevel,
    penalty_applied: comp.penaltyApplied,
  });

  if (insErr) {
    return { ok: false, message: insErr.message };
  }

  const { error: upErr } = await supabase
    .from(DB_TABLES.profiles)
    .update({
      is_leveled: true,
      category: comp.category,
      level: scoreRounded,
      base_level: payload.baseLevel,
      dominant_hand: payload.dominant_hand,
      play_position: payload.play_position,
      play_schedule: payload.play_schedule,
    })
    .eq("user_id", user.id);

  if (upErr) {
    return { ok: false, message: upErr.message };
  }

  revalidatePath("/perfil");
  revalidatePath("/home");
  revalidatePath(`/jugador/${user.id}`);

  return {
    ok: true,
    message: "Perfil nivelado correctamente.",
    warnings: {
      penalty: comp.penaltyApplied,
      selfAssessment: comp.selfAssessmentWarning,
    },
  };
}
