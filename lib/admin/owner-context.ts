import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export type OwnerCourt = { id: string; name: string | null; club_id: string };
export type OwnerClub = { id: string; name: string | null; logo_url: string | null };

export type OwnerAdminContext = {
  userId: string;
  clubs: OwnerClub[];
  clubIds: string[];
  courts: OwnerCourt[];
  courtIds: string[];
};

/**
 * React.cache solo deduplica dentro del mismo request Flight (layout + page + banners);
 * en Server Actions y Route Handlers se recalcula en cada llamada. No convertir a
 * unstable_cache ni "use cache", y no pasar el SupabaseClient como key (cada
 * createClient() es una instancia nueva y rompe el dedupe).
 */
const loadOwnerAdminContext = cache(async (): Promise<OwnerAdminContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: clubsData } = await supabase
    .from(DB_TABLES.clubs)
    .select("id,name,logo_url")
    .eq("owner_id", user.id)
    .order("name");

  const clubs = (clubsData ?? []) as OwnerClub[];
  const clubIds = clubs.map((c) => c.id);
  if (clubIds.length === 0) {
    return { userId: user.id, clubs, clubIds, courts: [], courtIds: [] };
  }

  const { data: courtsData } = await supabase
    .from(DB_TABLES.courts)
    .select("id,name,club_id")
    .in("club_id", clubIds)
    .order("name");

  const courts = (courtsData ?? []) as OwnerCourt[];
  return {
    userId: user.id,
    clubs,
    clubIds,
    courts,
    courtIds: courts.map((c) => c.id),
  };
});

/**
 * Ámbito de datos del dueño: clubes donde `owner_id` coincide y sus canchas.
 * Usar en Server Components / actions del panel admin.
 * El argumento se mantiene solo por compatibilidad con los callers existentes: no se usa.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getOwnerAdminContext(_supabase?: SupabaseClient): Promise<OwnerAdminContext | null> {
  return loadOwnerAdminContext();
}
