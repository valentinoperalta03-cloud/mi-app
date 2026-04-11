import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

export type OwnerCourt = { id: string; name: string | null; club_id: string };
export type OwnerClub = { id: string; name: string | null };

export type OwnerAdminContext = {
  userId: string;
  clubs: OwnerClub[];
  clubIds: string[];
  courts: OwnerCourt[];
  courtIds: string[];
};

/**
 * Ámbito de datos del dueño: clubes donde `owner_id` coincide y sus canchas.
 * Usar en Server Components / actions del panel admin.
 */
export async function getOwnerAdminContext(
  supabase: SupabaseClient
): Promise<OwnerAdminContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: clubsData } = await supabase
    .from(DB_TABLES.clubs)
    .select("id,name")
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
}
