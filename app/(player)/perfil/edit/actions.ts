"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { PROFILE_CATEGORIES, type ProfileCategoryValue } from "@/lib/profile-display";
import { createClient } from "@/utils/supabase/server";

function isValidCategory(v: string): v is ProfileCategoryValue {
  return (PROFILE_CATEGORIES as readonly string[]).includes(v);
}

export type EditProfileState = { ok: boolean; message: string };

export async function updateMyProfile(
  _prev: EditProfileState,
  formData: FormData
): Promise<EditProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "No hay sesión." };
  }

  const avatar_url = String(formData.get("avatar_url") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "").trim();

  if (categoryRaw && !isValidCategory(categoryRaw)) {
    return { ok: false, message: "Categoría no válida." };
  }

  const payload: Record<string, unknown> = {};
  if (avatar_url === "") {
    payload.avatar_url = null;
  } else {
    try {
      // Evita guardar strings absurdamente largos
      if (avatar_url.length > 2048) {
        return { ok: false, message: "La URL de la foto es demasiado larga." };
      }
      new URL(avatar_url);
      payload.avatar_url = avatar_url;
    } catch {
      return { ok: false, message: "Ingresá una URL de imagen válida (https://...)." };
    }
  }

  payload.category = categoryRaw === "" ? null : categoryRaw;

  const { error } = await supabase.from(DB_TABLES.profiles).update(payload).eq("user_id", user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/perfil");
  revalidatePath("/perfil/editar");
  revalidatePath(`/jugador/${user.id}`);
  revalidatePath("/home");

  return { ok: true, message: "Perfil actualizado." };
}
