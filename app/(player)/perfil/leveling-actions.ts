"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import {
  QUIZ_QUESTIONS,
  classifyCategory,
  computeLevelFromAnswers,
} from "@/lib/level-quiz-logic";
import { ensureProfileRowExists } from "@/lib/profiles";
import { createClient } from "@/utils/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CompleteLevelingResult = {
  ok: boolean;
  message: string;
  level?: number;
  category?: string;
};

export async function completeLevelingProfile(payload: {
  answers: number[];
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

  const { data: prof, error: profileReadError } = await supabase
    .from(DB_TABLES.profiles)
    .select("level, is_leveled, level_of_play")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileReadError) {
    return {
      ok: false,
      message:
        profileReadError.message +
        " | Si falta la columna level, ejecuta: alter table public.profiles add column if not exists level double precision;",
    };
  }

  const prof2 = prof as { level?: number | null; is_leveled?: boolean | null; level_of_play?: string | null } | null;
  const hasLevel =
    (prof2?.level != null && Number.isFinite(Number(prof2.level))) ||
    prof2?.is_leveled === true ||
    Boolean((prof2?.level_of_play ?? "").trim());
  if (hasLevel) {
    return { ok: false, message: "Ya completaste la nivelación." };
  }

  if (payload.answers.length !== QUIZ_QUESTIONS.length) {
    return { ok: false, message: "El cuestionario está incompleto o es inválido." };
  }

  let comp;
  try {
    comp = computeLevelFromAnswers(payload.answers);
  } catch {
    return { ok: false, message: "El cuestionario está incompleto o es inválido." };
  }

  const finalLevel = comp.mappedLevel;
  const category = classifyCategory(finalLevel);

  const { error: evoErr } = await supabase.from(DB_TABLES.levelEvolution).insert({
    user_id: user.id,
    score: finalLevel,
    category,
    old_level: null,
    new_level: finalLevel,
    source: "quiz",
    previous_score: null,
    new_score: finalLevel,
    delta: finalLevel,
  });

  if (evoErr) {
    return {
      ok: false,
      message:
        evoErr.message +
        " | Asegurate de ejecutar migraciones de level_evolution (old_level/new_level/source).",
    };
  }

  const { error: upErr } = await supabase
    .from(DB_TABLES.profiles)
    .update({
      level: finalLevel,
      level_of_play: category,
      category: category,
      technical_score: finalLevel,
      is_leveled: true,
    })
    .eq("user_id", user.id);

  if (upErr) {
    return {
      ok: false,
      message:
        upErr.message +
        " | Si falta la columna level, ejecuta: alter table public.profiles add column if not exists level double precision;",
    };
  }

  revalidatePath("/perfil");
  revalidatePath("/nivelacion");
  revalidatePath("/home");
  revalidatePath(`/jugador/${userId}`);

  return {
    ok: true,
    message: "Perfil nivelado correctamente.",
    level: finalLevel,
    category,
  };
}
