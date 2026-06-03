"use server";

import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export async function markSlidesSeenAction() {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from(DB_TABLES.profiles).update({ slides_seen: true }).eq("user_id", user.id);
}
