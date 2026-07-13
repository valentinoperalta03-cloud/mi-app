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
  const surface = getField(formData, "surface");
  const indoor = formData.get("indoor") === "on";
  const imageUrl = getField(formData, "image_url");

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
    surface: surface || null,
    indoor,
    image_url: imageUrl || null,
  });

  if (error) {
    redirectCanchasError(error.message);
  }

  revalidatePath("/admin/canchas");
  redirect("/admin/canchas");
}

export async function updateCourt(formData: FormData): Promise<void> {
  const courtId = getField(formData, "court_id");
  const name = getField(formData, "name");
  const priceRaw = getField(formData, "price");
  const surface = getField(formData, "surface");
  const indoor = formData.get("indoor") === "on";
  const imageUrl = getField(formData, "image_url");
  const requiresDeposit = formData.get("requires_deposit") === "on";
  const depositTypeRaw = getField(formData, "deposit_type");
  const depositType = depositTypeRaw === "percentage" || depositTypeRaw === "fixed" ? depositTypeRaw : null;
  const depositValueRaw = getField(formData, "deposit_value");
  const depositValue = depositValueRaw ? Number(depositValueRaw) : 0;

  if (!courtId || !name) {
    redirectCanchasError("Completá los datos de la cancha.");
  }
  const price = Number.parseInt(priceRaw, 10);
  if (!Number.isFinite(price) || price < 0) {
    redirectCanchasError("Precio inválido.");
  }
  if (requiresDeposit) {
    if (depositType !== "percentage" && depositType !== "fixed") {
      redirectCanchasError("Elegí el tipo de seña.");
    }
    if (!Number.isFinite(depositValue)) {
      redirectCanchasError("Monto de seña inválido.");
    }
    if (depositType === "percentage" && (depositValue < 1 || depositValue > 100)) {
      redirectCanchasError("El porcentaje de seña debe estar entre 1 y 100.");
    }
    if (depositType === "fixed" && depositValue <= 0) {
      redirectCanchasError("El monto fijo de seña debe ser mayor a 0.");
    }
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.courtIds.includes(courtId)) {
    redirectCanchasError("Cancha no autorizada.");
  }

  const { error } = await supabase
    .from(DB_TABLES.courts)
    .update({
      name,
      price,
      surface: surface || null,
      indoor,
      image_url: imageUrl || null,
      requires_deposit: requiresDeposit,
      deposit_type: requiresDeposit ? depositType : null,
      deposit_value: requiresDeposit ? depositValue : 0,
    })
    .eq("id", courtId);

  if (error) {
    redirectCanchasError(error.message);
  }
  revalidatePath("/admin/canchas");
  redirect("/admin/canchas");
}

export async function deleteCourt(formData: FormData): Promise<void> {
  const courtId = getField(formData, "court_id");
  if (!courtId) {
    redirectCanchasError("Cancha inválida.");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.courtIds.includes(courtId)) {
    redirectCanchasError("Cancha no autorizada.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from(DB_TABLES.matches)
    .select("id", { count: "exact", head: true })
    .eq("court_id", courtId)
    .eq("match_type", "reservation")
    .gte("scheduled_date", today);

  if ((count ?? 0) > 0) {
    redirectCanchasError("No podés eliminar una cancha con reservas futuras.");
  }

  const { error } = await supabase.from(DB_TABLES.courts).delete().eq("id", courtId);
  if (error) redirectCanchasError(error.message);

  revalidatePath("/admin/canchas");
  redirect("/admin/canchas");
}
