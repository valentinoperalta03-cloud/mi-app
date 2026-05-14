import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";

export async function notifyClubOwner(
  supabase: SupabaseClient,
  clubId: string,
  params: { title: string; body: string; match_id?: string }
): Promise<void> {
  const id = String(clubId ?? "").trim();
  if (!id) return;
  const { data: row } = await supabase.from(DB_TABLES.clubs).select("owner_id").eq("id", id).maybeSingle();
  const ownerId = String((row as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
  if (!ownerId) return;
  await createNotification(supabase, {
    user_id: ownerId,
    type: "club_agenda",
    title: params.title,
    body: params.body,
    match_id: params.match_id,
  });
}
