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
};

const MIN_COURT_QUANTITY = 1;
const MAX_COURT_QUANTITY = 15;

/** Sin numerar si es una sola cancha; si no, sufijo secuencial de 2 digitos ("Cancha 01", "Cancha 02", ...). */
function buildCourtName(baseName: string, index: number, quantity: number): string {
  if (quantity <= 1) return baseName;
  return `${baseName} ${String(index + 1).padStart(2, "0")}`;
}

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
  const quantityRaw = getField(formData, "quantity");

  if (!name || !clubId) {
    return { ok: false, message: "Completá nombre y club." };
  }
  const price = Number.parseInt(priceRaw, 10);
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, message: "Precio inválido." };
  }
  const quantity = Number.parseInt(quantityRaw, 10);
  if (!Number.isInteger(quantity) || quantity < MIN_COURT_QUANTITY || quantity > MAX_COURT_QUANTITY) {
    return { ok: false, message: "Cantidad de canchas inválida." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) {
    redirect("/login");
  }
  if (!ctx.clubIds.includes(clubId)) {
    return { ok: false, message: "Club no autorizado." };
  }

  const rows = Array.from({ length: quantity }, (_, i) => ({
    club_id: clubId,
    name: buildCourtName(name, i, quantity),
    price,
    surface: surface || null,
    indoor,
    image_url: imageUrl || null,
  }));

  const { error } = await supabase.from(DB_TABLES.courts).insert(rows);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/canchas");
  return {
    ok: true,
    message: quantity === 1 ? "Cancha creada." : `${quantity} canchas creadas.`,
  };
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
