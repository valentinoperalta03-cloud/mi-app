"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export type EditProfileState = { ok: boolean; message: string };

const COURT_POSITIONS = ["drive", "reves", "ambas"] as const;
const HANDS = ["derecha", "izquierda"] as const;

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

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { ok: false, message: "Ingresá tu nombre." };
  }
  if (name.length > 120) {
    return { ok: false, message: "El nombre es demasiado largo." };
  }

  const ageRaw = String(formData.get("age") ?? "").trim();
  let age: number | null = null;
  if (ageRaw !== "") {
    const n = Number.parseInt(ageRaw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 120) {
      return { ok: false, message: "Edad no válida (1–120)." };
    }
    age = n;
  }

  const bio = String(formData.get("bio") ?? "").trim();
  if (bio.length > 2000) {
    return { ok: false, message: "La descripción no puede superar los 2000 caracteres." };
  }

  const court_position = String(formData.get("court_position") ?? "").trim();
  if (!COURT_POSITIONS.includes(court_position as (typeof COURT_POSITIONS)[number])) {
    return { ok: false, message: "Elegí una posición válida." };
  }

  const preferred_hand = String(formData.get("preferred_hand") ?? "").trim();
  if (!HANDS.includes(preferred_hand as (typeof HANDS)[number])) {
    return { ok: false, message: "Elegí una mano hábil válida." };
  }

  const currentAvatarUrl = String(formData.get("current_avatar_url") ?? "").trim();
  const avatarFile = formData.get("avatar_file");
  const payload: Record<string, unknown> = {
    name,
    age,
    bio: bio === "" ? null : bio,
    court_position,
    preferred_hand,
  };

  if (avatarFile instanceof File && avatarFile.size > 0) {
    if (!avatarFile.type.startsWith("image/")) {
      return { ok: false, message: "Subí una imagen válida (JPG, PNG o WEBP)." };
    }
    const avatarPath = `${user.id}/avatar.png`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(avatarPath, avatarFile, {
      upsert: true,
      contentType: avatarFile.type || "image/png",
    });
    if (uploadError) {
      return { ok: false, message: `No se pudo subir la imagen: ${uploadError.message}` };
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(avatarPath);
    payload.avatar_url = `${publicUrl}?v=${Date.now()}`;
  } else if (currentAvatarUrl === "") {
    payload.avatar_url = null;
  }

  const { error } = await supabase.from(DB_TABLES.profiles).update(payload).eq("user_id", user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/perfil");
  revalidatePath("/perfil/editar");
  revalidatePath(`/jugador/${user.id}`);
  revalidatePath("/home");
  revalidatePath("/", "layout");

  return { ok: true, message: "Perfil actualizado." };
}

export async function deleteMyAccount(): Promise<EditProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "No hay sesión." };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return {
      ok: false,
      message:
        "Eliminar cuenta no está habilitado en este entorno. Contactá soporte o configurá SUPABASE_SERVICE_ROLE_KEY en el servidor.",
    };
  }

  const admin = createSupabaseAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Cuenta eliminada." };
}
