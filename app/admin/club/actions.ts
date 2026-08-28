"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { buildClubLocationPayload } from "@/lib/locations";
import { createClient, createServiceClient } from "@/utils/supabase/server";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalizeInstagram(raw: string) {
  const s = raw.replace(/^@+/, "").trim();
  return s || null;
}

async function ownerClubContext() {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length) redirect("/admin/config/informacion?data_error=no_club");
  return { supabase, ctx, clubId: ctx.clubIds[0]! };
}

export async function saveClubLocation(formData: FormData) {
  const { ctx, clubId } = await ownerClubContext();

  const locationCountry = getField(formData, "country");
  const locationProvince = getField(formData, "province");
  const locationCity = getField(formData, "city") || getField(formData, "location");

  if (!locationCity) {
    redirect("/admin/config/informacion?location_error=Seleccion%C3%A1%20una%20ciudad");
  }

  const payload = buildClubLocationPayload({
    country: locationCountry || "Argentina",
    province: locationProvince,
    city: locationCity,
  });

  const { error } = await createServiceClient()
    .from(DB_TABLES.clubs)
    .update(payload)
    .eq("id", clubId)
    .eq("owner_id", ctx.userId);
  if (error) {
    redirect(`/admin/config/informacion?location_error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/config/informacion");
  revalidatePath("/clubes");
  redirect("/admin/config/informacion?location_saved=1");
}

export async function saveClubData(formData: FormData) {
  const { ctx, clubId } = await ownerClubContext();

  const payload = {
    name: getField(formData, "name") || null,
    description: getField(formData, "description") || null,
    address: getField(formData, "address") || null,
    contact_phone: getField(formData, "contact_phone") || null,
    whatsapp: getField(formData, "whatsapp") || null,
    instagram: normalizeInstagram(getField(formData, "instagram")),
    business_hours: getField(formData, "business_hours") || null,
  };

  const { error } = await createServiceClient()
    .from(DB_TABLES.clubs)
    .update(payload)
    .eq("id", clubId)
    .eq("owner_id", ctx.userId);
  if (error) {
    redirect(`/admin/config/informacion?data_error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/config/informacion");
  redirect("/admin/config/informacion?data_saved=1");
}

export async function saveClubPhotos(formData: FormData) {
  const { ctx, clubId } = await ownerClubContext();

  const payload = {
    logo_url: getField(formData, "logo_url") || null,
    cover_image_url: getField(formData, "cover_image_url") || null,
    gallery_image_1: getField(formData, "gallery_image_1") || null,
    gallery_image_2: getField(formData, "gallery_image_2") || null,
    gallery_image_3: getField(formData, "gallery_image_3") || null,
    gallery_image_4: getField(formData, "gallery_image_4") || null,
  };

  const { error } = await createServiceClient()
    .from(DB_TABLES.clubs)
    .update(payload)
    .eq("id", clubId)
    .eq("owner_id", ctx.userId);
  if (error) {
    redirect(`/admin/config/informacion?photos_error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/config/informacion");
  redirect("/admin/config/informacion?photos_saved=1");
}

/** @deprecated Usar saveClubData / saveClubPhotos desde Config. */
export async function updateClubInfo(formData: FormData) {
  const supabaseAction = await createClient({ allowCookieWrites: true });
  const actionCtx = await getOwnerAdminContext(supabaseAction);
  if (!actionCtx?.userId) redirect("/login");
  if (!actionCtx.clubIds.length) redirect("/admin/config?data_error=no_club");

  const locationCountry = getField(formData, "country");
  const locationProvince = getField(formData, "province");
  const locationCity = getField(formData, "city") || getField(formData, "location");

  const locationPayload =
    locationCity.trim().length > 0
      ? buildClubLocationPayload({
          country: locationCountry || "Argentina",
          province: locationProvince || "",
          city: locationCity,
        })
      : { location: getField(formData, "location") || null };

  const payload = {
    name: getField(formData, "name") || null,
    ...locationPayload,
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
    accepts_cash: formData.get("accepts_cash") === "on",
    accepts_transfer: formData.get("accepts_transfer") === "on",
    bank_alias: getField(formData, "bank_alias") || null,
    bank_cbu: getField(formData, "bank_cbu") || null,
  };

  const { error } = await supabaseAction
    .from(DB_TABLES.clubs)
    .update(payload)
    .eq("id", actionCtx.clubIds[0])
    .eq("owner_id", actionCtx.userId);
  if (error) {
    redirect(`/admin/config?data_error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/config");
  redirect("/admin/config?data_saved=1");
}
