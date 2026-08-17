"use server";

import { revalidatePath } from "next/cache";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export async function blockPlayerAction(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "").trim();
  if (!userId) return;
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !ctx.clubIds.length) return;
  await supabase.from(DB_TABLES.blockedUsers).upsert({
    club_id: ctx.clubIds[0],
    user_id: userId,
    reason: "Bloqueado desde panel admin",
  });
  revalidatePath("/admin/jugadores");
}

export async function unblockPlayerAction(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "").trim();
  if (!userId) return;
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !ctx.clubIds.length) return;
  await supabase
    .from(DB_TABLES.blockedUsers)
    .delete()
    .eq("club_id", ctx.clubIds[0])
    .eq("user_id", userId);
  revalidatePath("/admin/jugadores");
}
