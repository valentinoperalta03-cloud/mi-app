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
      level: "beginner",
    },
    { onConflict: "user_id" }
  );

  return { error: error?.message ?? null };
}
