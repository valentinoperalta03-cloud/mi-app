"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient, createServiceClient } from "@/utils/supabase/server";

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectCanchasError(message: string): never {
  redirect(`/admin/canchas?error=${encodeURIComponent(message)}`);
}

export type CreateCourtState = {
  ok: boolean;
  message: string;
  court?: {
    id: string;
    name: string;
    price: number;
    surface: string | null;
    indoor: boolean;
    image_url: string | null;
    club_id: string;
  };
};

export async function createCourt(
  _prev: CreateCourtState,
  formData: FormData
): Promise<CreateCourtState> {
  void _prev;
  const name = getField(formData, "name");
  const priceRaw = getField(formData, "price");
  const clubId = getField(formData, "club_id");
  const surface = getField(formData, "surface");
  const indoor = formData.get("indoor") === "on";
  const imageUrl = getField(formData, "image_url");

  if (!name || !clubId) {
    return { ok: false, message: "Completá nombre y club." };
  }
  const price = Number.parseInt(priceRaw, 10);
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, message: "Precio inválido." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    redirect("/login");
  }
  if (!ctx.clubIds.includes(clubId)) {
    return { ok: false, message: "Club no autorizado." };
  }

  const { data, error } = await supabase
    .from(DB_TABLES.courts)
    .insert({
      club_id: clubId,
      name,
      price,
      surface: surface || null,
      indoor,
      image_url: imageUrl || null,
    })
    .select("id,name,price,surface,indoor,image_url,club_id")
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "No se pudo crear la cancha." };
  }

  revalidatePath("/admin/canchas");
  return { ok: true, message: "", court: data as CreateCourtState["court"] };
}

export async function duplicateCourtAction(
  sourceCourtId: string,
  count: number
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    return { ok: false, error: "Cantidad inválida." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    return { ok: false, error: "Sesión requerida." };
  }
  if (!ctx.courtIds.includes(sourceCourtId)) {
    return { ok: false, error: "Cancha no autorizada." };
  }

  const { data: source, error: sourceError } = await supabase
    .from(DB_TABLES.courts)
    .select("club_id,price,surface,indoor,image_url")
    .eq("id", sourceCourtId)
    .maybeSingle();

  if (sourceError || !source) {
    return { ok: false, error: sourceError?.message ?? "Cancha no encontrada." };
  }

  const sourceCourt = source as {
    club_id: string;
    price: number | null;
    surface: string | null;
    indoor: boolean | null;
    image_url: string | null;
  };

  const { count: existingCount } = await supabase
    .from(DB_TABLES.courts)
    .select("id", { count: "exact", head: true })
    .eq("club_id", sourceCourt.club_id);

  const startNumber = (existingCount ?? 0) + 1;
  const rows = Array.from({ length: count }, (_, i) => ({
    club_id: sourceCourt.club_id,
    name: `Cancha ${startNumber + i}`,
    price: sourceCourt.price,
    surface: sourceCourt.surface,
    indoor: Boolean(sourceCourt.indoor),
    image_url: sourceCourt.image_url,
  }));

  const { error } = await supabase.from(DB_TABLES.courts).insert(rows);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/canchas");
  return { ok: true };
}

export async function updateCourt(formData: FormData): Promise<void> {
  const courtId = getField(formData, "court_id");
  const name = getField(formData, "name");
  const priceRaw = getField(formData, "price");
  const surface = getField(formData, "surface");
  const indoor = formData.get("indoor") === "on";
  const imageUrl = getField(formData, "image_url");

  if (!courtId || !name) {
    redirectCanchasError("Completá los datos de la cancha.");
  }
  const price = Number.parseInt(priceRaw, 10);
  if (!Number.isFinite(price) || price < 0) {
    redirectCanchasError("Precio inválido.");
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
    })
    .eq("id", courtId);

  if (error) {
    redirectCanchasError(error.message);
  }
  revalidatePath("/admin/canchas");
  redirect("/admin/canchas");
}

export async function updateClubDeposit(formData: FormData): Promise<void> {
  const clubId = getField(formData, "club_id");
  const depositTypeRaw = getField(formData, "deposit_type");
  const depositType = depositTypeRaw === "percentage" || depositTypeRaw === "fixed" ? depositTypeRaw : null;
  const depositValueRaw = getField(formData, "deposit_value");
  const depositValue = depositValueRaw ? Number(depositValueRaw) : 0;

  if (!clubId) {
    redirectCanchasError("Club inválido.");
  }
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

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.includes(clubId)) {
    redirectCanchasError("Club no autorizado.");
  }

  // deposit_type/deposit_value no tienen GRANT UPDATE para authenticated (mismo
  // patron que finance_pin/mp_access_token): se escriben con service client.
  // La pertenencia ya se validó arriba vía getOwnerAdminContext(supabase).
  const { error } = await createServiceClient()
    .from(DB_TABLES.clubs)
    .update({ deposit_type: depositType, deposit_value: depositValue })
    .eq("id", clubId)
    .eq("owner_id", ctx.userId);

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
