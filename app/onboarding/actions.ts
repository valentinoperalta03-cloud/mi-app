"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { sanitizeText } from "@/lib/sanitize";
import { calculatePlayerLevel, type OnboardingAnswers } from "@/lib/onboarding-level-calculator";
import { ensureProfileRowExists } from "@/lib/profiles";
import { updateMyProfile } from "@/app/(player)/perfil/edit/actions";
import { createClient } from "@/utils/supabase/server";

const ANSWER_KEYS: (keyof OnboardingAnswers)[] = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];

type OnboardingPayload = {
  name: string;
  gender: "masculino" | "femenino";
  age?: number | null;
  avatarUrl?: string | null;
  preferredHand: "derecha" | "izquierda" | "ambas";
  courtPosition: "drive" | "reves" | "ambas";
  preferredSchedule: "manana" | "tarde" | "noche" | "cualquiera";
  phone: string;
  answers: OnboardingAnswers;
};

export type CompleteOnboardingResult = { ok: boolean; message: string; level?: string };

export async function completeOnboarding(payload: OnboardingPayload): Promise<CompleteOnboardingResult> {
  const name = sanitizeText(payload.name ?? "", 120);
  const avatarUrl = String(payload.avatarUrl ?? "").trim();
  const gender = String(payload.gender ?? "").trim().toLowerCase();
  const preferredHand = String(payload.preferredHand ?? "").trim().toLowerCase();
  const courtPosition = String(payload.courtPosition ?? "").trim().toLowerCase();
  const preferredSchedule = String(payload.preferredSchedule ?? "").trim().toLowerCase();
  const phone = String(payload.phone ?? "").replace(/[^\d+]/g, "").trim();

  if (!name) return { ok: false, message: "Ingresá tu nombre." };
  if (gender !== "masculino" && gender !== "femenino") {
    return { ok: false, message: "Seleccioná un género válido." };
  }
  if (!["derecha", "izquierda", "ambas"].includes(preferredHand)) {
    return { ok: false, message: "Seleccioná mano hábil." };
  }
  if (!["drive", "reves", "ambas"].includes(courtPosition)) {
    return { ok: false, message: "Seleccioná posición en cancha." };
  }
  if (!["manana", "tarde", "noche", "cualquiera"].includes(preferredSchedule)) {
    return { ok: false, message: "Seleccioná horario favorito." };
  }
  if (phone.replace(/\D/g, "").length < 8) {
    return { ok: false, message: "Ingresá un número de WhatsApp válido." };
  }

  let age: number | null = null;
  if (payload.age != null) {
    const parsed = Number(payload.age);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 120) {
      return { ok: false, message: "Edad no válida (1–120)." };
    }
    age = Math.floor(parsed);
  }

  const answers = payload.answers;
  for (const key of ANSWER_KEYS) {
    if (!answers || typeof answers[key] !== "string" || !answers[key]) {
      return { ok: false, message: "El cuestionario está incompleto." };
    }
  }

  const profileForm = new FormData();
  profileForm.set("name", name);
  profileForm.set("gender", gender);
  profileForm.set("age", age == null ? "" : String(age));
  profileForm.set("bio", "");
  profileForm.set("avatar_url", avatarUrl);
  profileForm.set("preferred_hand", preferredHand);
  profileForm.set("court_position", courtPosition);
  profileForm.set("preferred_schedule", preferredSchedule);

  const profileRes = await updateMyProfile({ ok: false, message: "" }, profileForm);
  if (!profileRes.ok) return { ok: false, message: profileRes.message };

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Iniciá sesión." };

  const ensure = await ensureProfileRowExists(supabase, user);
  if (ensure.error) return { ok: false, message: ensure.error };

  const { data: existing } = await supabase
    .from(DB_TABLES.profiles)
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();
  if ((existing as { onboarding_completed?: boolean | null } | null)?.onboarding_completed) {
    return { ok: false, message: "Ya completaste el onboarding." };
  }

  const category = calculatePlayerLevel(answers);

  const { error } = await supabase
    .from(DB_TABLES.profiles)
    .update({
      category,
      phone,
      onboarding_completed: true,
    })
    .eq("user_id", user.id);
  if (error) return { ok: false, message: "No se pudo completar el onboarding." };

  revalidatePath("/home");
  revalidatePath("/onboarding");
  revalidatePath(`/jugador/${user.id}`);
  return { ok: true, message: "Onboarding completado.", level: category };
}
