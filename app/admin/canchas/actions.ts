"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectCanchasError(message: string): never {
  redirect(`/admin/canchas?error=${encodeURIComponent(message)}`);
}

export async function createCourt(formData: FormData): Promise<void> {
  const name = getField(formData, "name");
  const priceRaw = getField(formData, "price");
  const clubId = getField(formData, "club_id");

  if (!name || !clubId) {
    redirectCanchasError("Completá nombre y club.");
  }
  const price = Number.parseInt(priceRaw, 10);
  if (!Number.isFinite(price) || price < 0) {
    redirectCanchasError("Precio inválido.");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    redirect("/login");
  }
  if (!ctx.clubIds.includes(clubId)) {
    redirectCanchasError("Club no autorizado.");
  }

  const { error } = await supabase.from(DB_TABLES.courts).insert({
    club_id: clubId,
    name,
    price,
  });

  if (error) {
    redirectCanchasError(error.message);
  }

  revalidatePath("/admin/canchas");
  redirect("/admin/canchas");
}
