"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { PROFILE_CATEGORIES } from "@/lib/profile-display";
import { sanitizeText } from "@/lib/sanitize";
import { ensureProfileRowExists } from "@/lib/profiles";
import { arMobileProblem, normalizeArMobile } from "@/lib/phone-ar";
import { createClient } from "@/utils/supabase/server";

type CompletarPerfilPayload = {
  name: string;
  age?: number | null;
  gender: "masculino" | "femenino";
  avatarUrl?: string | null;
  preferredHand: "derecha" | "izquierda" | "ambas";
  courtPosition: "drive" | "reves" | "ambas";
  preferredSchedule: "manana" | "tarde" | "noche" | "cualquiera";
  category: string;
  phone: string;
  // El jugador confirmó que el número es suyo. Es una declaración, no una verificación.
  phoneConfirmed: boolean;
  province: string;
  city: string;
  next?: string | null;
};

export type CompletarPerfilResult = { ok: boolean; message: string };

export async function completarPerfilAction(
  payload: CompletarPerfilPayload
): Promise<CompletarPerfilResult> {
  const name = sanitizeText(payload.name ?? "", 120);
  const age =
    typeof payload.age === "number" && Number.isInteger(payload.age) && payload.age > 0 && payload.age < 120
      ? payload.age
      : null;
  const avatarUrl = String(payload.avatarUrl ?? "").trim();
  const gender = String(payload.gender ?? "").trim().toLowerCase();
  const preferredHand = String(payload.preferredHand ?? "").trim().toLowerCase();
  const courtPosition = String(payload.courtPosition ?? "").trim().toLowerCase();
  const preferredSchedule = String(payload.preferredSchedule ?? "").trim().toLowerCase();
  const category = String(payload.category ?? "").trim();
  const phone = normalizeArMobile(payload.phone ?? "");
  const province = sanitizeText(payload.province ?? "", 80);
  const city = sanitizeText(payload.city ?? "", 80);

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
  if (!PROFILE_CATEGORIES.includes(category as (typeof PROFILE_CATEGORIES)[number])) {
    return { ok: false, message: "Seleccioná tu categoría." };
  }
  if (!phone) {
    return { ok: false, message: arMobileProblem(payload.phone ?? "") ?? "Revisá el número que ingresaste." };
  }
  if (payload.phoneConfirmed !== true) {
    return { ok: false, message: "Confirmá que tu número es correcto." };
  }
  if (!province) {
    return { ok: false, message: "Seleccioná tu provincia." };
  }

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
    return { ok: false, message: "Ya completaste tu perfil." };
  }

  // phone y onboarding_completed no son escribibles desde la sesión: la RPC
  // revalida el formato y solo actúa sobre la fila propia.
  const { error } = await supabase.rpc("complete_player_onboarding", {
    p_name: name,
    p_age: age,
    p_gender: gender,
    p_avatar_url: avatarUrl || null,
    p_preferred_hand: preferredHand,
    p_court_position: courtPosition,
    p_preferred_schedule: preferredSchedule,
    p_category: category,
    p_phone: phone,
    p_province: province,
    p_city: city || null,
  });
  if (error) {
    if (error.message.includes("invalid_phone")) {
      return { ok: false, message: "Revisá el número que ingresaste." };
    }
    if (error.message.includes("onboarding_unavailable")) {
      return { ok: false, message: "Ya completaste tu perfil." };
    }
    console.error("[completar-perfil] complete_player_onboarding", { userId: user.id, code: error.code });
    return { ok: false, message: "No se pudo guardar tu perfil." };
  }

  revalidatePath("/home");
  revalidatePath("/completar-perfil");
  revalidatePath(`/jugador/${user.id}`);

  const next = sanitizeText(payload.next ?? "", 200);
  redirect(next && next.startsWith("/") ? next : "/home");
}
