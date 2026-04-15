import type { SupabaseClient, User } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

function defaultDisplayName(user: User): string {
  const meta = user.user_metadata;
  if (meta && typeof meta.full_name === "string" && meta.full_name.trim()) {
    return meta.full_name.trim();
  }
  if (meta && typeof meta.name === "string" && meta.name.trim()) {
    return meta.name.trim();
  }
  const local = user.email?.split("@")[0];
  return local?.trim() || "Jugador";
}

/**
 * Crea o actualiza `profiles` para el usuario de Auth (user_id).
 * Requiere política RLS que permita upsert cuando auth.uid() = user_id.
 */
export async function upsertProfileForAuthUser(
  supabase: SupabaseClient,
  user: User
): Promise<{ error: string | null }> {
  const { error } = await supabase.from(DB_TABLES.profiles).upsert(
    {
      user_id: user.id,
      name: defaultDisplayName(user),
    },
    { onConflict: "user_id" }
  );

  return { error: error?.message ?? null };
}

/**
 * Garantiza una fila en `profiles` sin pisar datos existentes.
 * Útil antes de inserts con FK a `profiles.user_id`.
 */
export async function ensureProfileRowExists(
  supabase: SupabaseClient,
  user: User
): Promise<{ error: string | null }> {
  const { data } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (data) {
    return { error: null };
  }

  const { error } = await supabase.from(DB_TABLES.profiles).insert({
    user_id: user.id,
    name: defaultDisplayName(user),
  });

  if (error?.code === "23505") {
    return { error: null };
  }
  return { error: error?.message ?? null };
}
