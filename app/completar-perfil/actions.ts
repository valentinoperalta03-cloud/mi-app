"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { PROFILE_CATEGORIES } from "@/lib/profile-display";
import { sanitizeText } from "@/lib/sanitize";
import { ensureProfileRowExists } from "@/lib/profiles";
import { createClient } from "@/utils/supabase/server";

type CompletarPerfilPayload = {
  name: string;
  gender: "masculino" | "femenino";
  avatarUrl?: string | null;
  preferredHand: "derecha" | "izquierda" | "ambas";
  courtPosition: "drive" | "reves" | "ambas";
  preferredSchedule: "manana" | "tarde" | "noche" | "cualquiera";
  category: string;
  phone: string;
  province: string;
  city: string;
};

export type CompletarPerfilResult = { ok: boolean; message: string };

export async function completarPerfilAction(
  payload: CompletarPerfilPayload
): Promise<CompletarPerfilResult> {
  const name = sanitizeText(payload.name ?? "", 120);
  const avatarUrl = String(payload.avatarUrl ?? "").trim();
  const gender = String(payload.gender ?? "").trim().toLowerCase();
  const preferredHand = String(payload.preferredHand ?? "").trim().toLowerCase();
  const courtPosition = String(payload.courtPosition ?? "").trim().toLowerCase();
  const preferredSchedule = String(payload.preferredSchedule ?? "").trim().toLowerCase();
  const category = String(payload.category ?? "").trim();
  const phone = String(payload.phone ?? "").replace(/[^\d+]/g, "").trim();
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
  if (phone.replace(/\D/g, "").length < 8) {
    return { ok: false, message: "Verificá tu número de teléfono." };
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

  const { error } = await supabase
    .from(DB_TABLES.profiles)
    .update({
      name,
      gender,
      avatar_url: avatarUrl || null,
      preferred_hand: preferredHand,
      court_position: courtPosition,
      preferred_schedule: preferredSchedule,
      category,
      phone,
      province,
      city: city || null,
      onboarding_completed: true,
    })
    .eq("user_id", user.id);
  if (error) return { ok: false, message: "No se pudo guardar tu perfil." };

  revalidatePath("/home");
  revalidatePath("/completar-perfil");
  revalidatePath(`/jugador/${user.id}`);

  redirect("/home");
}
