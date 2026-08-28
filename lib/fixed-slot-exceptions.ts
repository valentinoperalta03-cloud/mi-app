import "server-only";
import { createServiceClient } from "@/utils/supabase/server";
import { DB_TABLES } from "@/lib/db-tables";

/**
 * Cuando se cancela un match de turno fijo, insertar la excepción para que
 * el generador no vuelva a crear un match para esa fecha. No-op si el match
 * no es turno fijo.
 */
export async function insertFixedSlotExceptionIfNeeded(matchId: string): Promise<void> {
  if (!matchId) return;
  const supabase = createServiceClient();

  const { data: match } = await supabase
    .from(DB_TABLES.matches)
    .select("es_turno_fijo, fixed_slot_id, scheduled_date")
    .eq("id", matchId)
    .maybeSingle();
  const typed = match as { es_turno_fijo: boolean | null; fixed_slot_id: string | null; scheduled_date: string | null } | null;

  if (!typed?.es_turno_fijo || !typed.fixed_slot_id || !typed.scheduled_date) return;

  await supabase.from(DB_TABLES.fixedSlotExceptions).upsert(
    { fixed_slot_id: typed.fixed_slot_id, exception_date: typed.scheduled_date },
    { onConflict: "fixed_slot_id,exception_date", ignoreDuplicates: true }
  );
}
