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
    .select("level")
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

  const row = prof as { level?: number | null } | null;
  const hasLevel = row?.level != null && Number.isFinite(Number(row.level));
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

  const finalLevel = Number(comp.average.toFixed(2));
  const category = classifyCategory(finalLevel);

  const { error: upErr } = await supabase
    .from(DB_TABLES.profiles)
    .upsert({
      user_id: user.id,
      level: finalLevel,
      level_of_play: category,
    });

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
