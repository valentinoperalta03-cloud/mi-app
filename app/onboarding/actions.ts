"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { sanitizeText } from "@/lib/sanitize";
import { completeLevelingProfile } from "@/app/(player)/perfil/leveling-actions";
import { updateMyProfile } from "@/app/(player)/perfil/edit/actions";
import { createClient } from "@/utils/supabase/server";

type OnboardingPayload = {
  name: string;
  gender: "masculino" | "femenino";
  age?: number | null;
  avatarUrl?: string | null;
  preferred_hand?: "derecha" | "izquierda" | "ambas";
  court_position?: "drive" | "reves" | "ambas";
  preferred_schedule?: "manana" | "tarde" | "noche" | "cualquiera";
  answers: number[];
};

export async function completeOnboarding(payload: OnboardingPayload): Promise<{ ok: boolean; message: string }> {
  const name = sanitizeText(payload.name ?? "", 120);
  const avatarUrl = String(payload.avatarUrl ?? "").trim();
  const gender = String(payload.gender ?? "").trim().toLowerCase();
  const preferredHand = String(payload.preferred_hand ?? "").trim().toLowerCase();
  const courtPosition = String(payload.court_position ?? "").trim().toLowerCase();
  const preferredSchedule = String(payload.preferred_schedule ?? "").trim().toLowerCase();
  const answers = Array.isArray(payload.answers) ? payload.answers : [];

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
  if (answers.length !== 10 || answers.some((a) => !Number.isFinite(a) || a < 1 || a > 5)) {
    return { ok: false, message: "Las respuestas del quiz son inválidas." };
  }

  let age: number | null = null;
  if (payload.age != null) {
    const parsed = Number(payload.age);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 120) {
      return { ok: false, message: "Edad no válida (1–120)." };
    }
    age = Math.floor(parsed);
  }

  const profileForm = new FormData();
  profileForm.set("name", name);
  profileForm.set("gender", gender);
  profileForm.set("age", age == null ? "" : String(age));
  profileForm.set("bio", "");
  profileForm.set("avatar_url", avatarUrl);

  const profileRes = await updateMyProfile({ ok: false, message: "" }, profileForm);
  if (!profileRes.ok) return { ok: false, message: profileRes.message };

  const levelRes = await completeLevelingProfile({ answers });
  if (!levelRes.ok) {
    const msg = String(levelRes.message ?? "").toLowerCase();
    const canIgnoreLevelingError = msg.includes("nivelación") || msg.includes("leveled");
    if (!canIgnoreLevelingError) {
      return { ok: false, message: levelRes.message };
    }
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Iniciá sesión." };

  const { error } = await supabase
    .from(DB_TABLES.profiles)
    .update({
      onboarding_completed: true,
      preferred_hand: preferredHand,
      court_position: courtPosition,
      preferred_schedule: preferredSchedule,
    })
    .eq("user_id", user.id);
  if (error) return { ok: false, message: "No se pudo completar el onboarding." };

  revalidatePath("/home");
  revalidatePath("/onboarding");
  revalidatePath(`/jugador/${user.id}`);
  return { ok: true, message: "Onboarding completado." };
}
