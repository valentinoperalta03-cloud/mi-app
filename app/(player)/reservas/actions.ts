"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export async function cancelReservation(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/reservas?error=cancel");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from(DB_TABLES.matches)
    .update({ match_status: "cancelled" })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    redirect("/reservas?error=cancel");
  }

  revalidatePath("/reservas");
  redirect("/reservas");
}
