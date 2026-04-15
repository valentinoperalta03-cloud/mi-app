"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import {
  computeLevelFromAnswers,
  type BaseLevelChoice,
} from "@/lib/level-quiz-logic";
import { ensureProfileRowExists } from "@/lib/profiles";
import {
  bandFromTechnicalScore,
  formatTechnicalLevelDisplay,
  quizScoreToTechnicalScore,
} from "@/lib/technical-score";
import { createClient } from "@/utils/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_TECH_SEED = 2.5;

export type CompleteLevelingResult = {
  ok: boolean;
  message: string;
  warnings?: { penalty: boolean; selfAssessment: boolean };
};

function isBaseLevel(v: string): v is BaseLevelChoice {
  return v === "principiante" || v === "intermedio" || v === "avanzado";
}

/** Valores TEXT en BD para `base_level` en historial: beginner | intermediate | advanced */
function baseLevelToEnglishText(choice: BaseLevelChoice): string {
  switch (choice) {
    case "principiante":
      return "beginner";
    case "intermedio":
      return "intermediate";
    case "avanzado":
      return "advanced";
    default:
      return choice;
  }
}

export async function completeLevelingProfile(payload: {
  answers: number[];
  baseLevel: string;
  preferred_hand: string;
  court_position: string;
  preferred_schedule: string;
}): Promise<CompleteLevelingResult> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: "Iniciá sesión." };
  }

  const userId = user.id;
  if (typeof userId !== "string" || !UUID_RE.test(userId)) {
    return { ok: false, message: "Sesión inválida: no se pudo obtener tu id de usuario." };
  }

  const profileEnsure = await ensureProfileRowExists(supabase, user);
  if (profileEnsure.error) {
    return { ok: false, message: profileEnsure.error };
  }

  const { data: prof } = await supabase
    .from(DB_TABLES.profiles)
    .select("level_of_play, technical_score")
    .eq("user_id", userId)
    .maybeSingle();

  const row = prof as { level_of_play?: string | null; technical_score?: number | null } | null;
  const hasTech = row?.technical_score != null && Number.isFinite(Number(row.technical_score));
  const hasLegacyLevel = Boolean(row?.level_of_play?.trim());
  if (hasTech || hasLegacyLevel) {
    return { ok: false, message: "Ya completaste la nivelación." };
  }

  if (!isBaseLevel(payload.baseLevel)) {
    return { ok: false, message: "Nivel inicial no válido." };
  }

  let comp;
  try {
    comp = computeLevelFromAnswers(payload.answers);
  } catch {
    return { ok: false, message: "El cuestionario está incompleto o es inválido." };
  }

  const technicalScore = quizScoreToTechnicalScore(comp.afterPenalty);
  const categoryBand = bandFromTechnicalScore(technicalScore);
  const levelLine = formatTechnicalLevelDisplay(technicalScore);
  const baseLevelText = baseLevelToEnglishText(payload.baseLevel);

  const { error: insErr } = await supabase.from(DB_TABLES.levelEvolution).insert({
    user_id: user.id,
    score: technicalScore,
    category: categoryBand,
    previous_score: DEFAULT_TECH_SEED,
    new_score: technicalScore,
    base_level: baseLevelText,
  });

  if (insErr) {
    return { ok: false, message: insErr.message };
  }

  const { error: upErr } = await supabase
    .from(DB_TABLES.profiles)
    .upsert({
      user_id: user.id,
      technical_score: technicalScore,
      level_of_play: levelLine,
      preferred_hand: payload.preferred_hand,
      court_position: payload.court_position,
      preferred_schedule: payload.preferred_schedule,
    });

  if (upErr) {
    return { ok: false, message: upErr.message };
  }

  revalidatePath("/perfil");
  revalidatePath("/nivelacion");
  revalidatePath("/home");
  revalidatePath(`/jugador/${userId}`);

  return {
    ok: true,
    message: "Perfil nivelado correctamente.",
    warnings: {
      penalty: comp.penaltyApplied,
      selfAssessment: comp.selfAssessmentWarning,
    },
  };
}
