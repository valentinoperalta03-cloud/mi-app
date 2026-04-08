"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createCourt(formData: FormData) {
  const clubId = getField(formData, "clubId");
  const name = getField(formData, "name");
  const priceRaw = getField(formData, "price");

  if (!clubId || !name || !priceRaw) return;

  const price = Number(priceRaw);
  if (Number.isNaN(price)) return;

  await supabase.from("courts").insert({
    club_id: clubId,
    name,
    price,
  });

  revalidatePath(`/clubs/${clubId}`);
}
