"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalizeInstagram(raw: string) {
  const s = raw.replace(/^@+/, "").trim();
  return s || null;
}

export async function updateClubInfo(formData: FormData) {
  try {
    const supabaseAction = await createClient({ allowCookieWrites: true });
    const actionCtx = await getOwnerAdminContext(supabaseAction);
    if (!actionCtx?.userId) {
      redirect("/login");
    }
    if (!actionCtx.clubIds.length) {
      redirect("/admin/club?error=no_club");
    }
    const ownClubId = actionCtx.clubIds[0];

    const payload = {
      name: getField(formData, "name") || null,
      location: getField(formData, "location") || null,
      description: getField(formData, "description") || null,
      address: getField(formData, "address") || null,
      contact_phone: getField(formData, "contact_phone") || null,
      whatsapp: getField(formData, "whatsapp") || null,
      instagram: normalizeInstagram(getField(formData, "instagram")),
      business_hours: getField(formData, "business_hours") || null,
      logo_url: getField(formData, "logo_url") || null,
      cover_image_url: getField(formData, "cover_image_url") || null,
      gallery_image_1: getField(formData, "gallery_image_1") || null,
      gallery_image_2: getField(formData, "gallery_image_2") || null,
      gallery_image_3: getField(formData, "gallery_image_3") || null,
      gallery_image_4: getField(formData, "gallery_image_4") || null,
      cancellation_policy: getField(formData, "cancellation_policy") || null,
    };

    const { error } = await supabaseAction
      .from(DB_TABLES.clubs)
      .update(payload)
      .eq("id", ownClubId)
      .eq("owner_id", actionCtx.userId);
    if (error) {
      await supabaseAction
        .from(DB_TABLES.clubs)
        .update({ name: payload.name })
        .eq("id", ownClubId)
        .eq("owner_id", actionCtx.userId);
    }
  } catch (error) {
    console.error("[admin/club] update error", error);
  }

  revalidatePath("/admin/club");
  redirect("/admin/club?saved=1");
}
