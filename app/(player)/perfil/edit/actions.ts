"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

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

  const avatarUrlRaw = String(formData.get("avatar_url") ?? "").trim();
  if (avatarUrlRaw.startsWith("data:")) {
    return {
      ok: false,
      message: "La foto debe subirse desde el dispositivo antes de guardar (no se aceptan datos embebidos).",
    };
  }
  if (avatarUrlRaw.length > 2048) {
    return { ok: false, message: "La URL del avatar es inválida." };
  }

  const payload: Record<string, unknown> = {
    name,
    age,
    bio: bio === "" ? null : bio,
  };

  payload.avatar_url = avatarUrlRaw === "" ? null : avatarUrlRaw;

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
