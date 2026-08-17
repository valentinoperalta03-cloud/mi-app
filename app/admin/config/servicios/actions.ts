"use server";

import { DB_TABLES } from "@/lib/db-tables";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";

const VALID_KEYS = [
  "cancha_techada",
  "filmacion",
  "parrilla",
  "cobertura_medica",
  "estacionamiento",
  "venta_pelotas",
  "pelotas_prestadas",
  "paletas_prestadas",
  "alquiler_paletas",
  "venta_grips",
  "venta_indumentaria",
  "vestuarios",
  "wifi",
  "buffet",
  "pro_shop",
  "cumpleanos",
  "aire_acondicionado",
  "acceso_discapacidad",
  "guardarropa",
  "gimnasio",
];

export async function updateClubServices(
  clubId: string,
  services: string[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, error: "No autorizado." };
  if (!ctx.clubIds.includes(clubId)) return { ok: false, error: "No autorizado." };

  const validServices = services.filter((s) => VALID_KEYS.includes(s));

  const { error } = await supabase
    .from(DB_TABLES.clubs)
    .update({ services: validServices })
    .eq("id", clubId)
    .eq("owner_id", ctx.userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
