import { cache } from "react";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export const getCachedProfileDisplayName = cache(async (userId: string): Promise<string> => {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from(DB_TABLES.profiles)
    .select("name")
    .eq("user_id", userId)
    .maybeSingle();

  return (profile as { name?: string | null } | null)?.name?.trim() || "Jugador";
});

/** Precalienta datos del home en el mismo request. */
export async function warmupHomeData(userId: string) {
  await getCachedProfileDisplayName(userId);
}
