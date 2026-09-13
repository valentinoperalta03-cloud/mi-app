import { DB_TABLES } from "@/lib/db-tables";

type GuardResult =
  | { allowed: true }
  | { allowed: false; reason: "db_error" | "rate_limit"; message: string };

export async function checkCancellationLimit(
  supabase: { from: (table: string) => any },
  userId: string
): Promise<GuardResult> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  // matches no tiene updated_at (solo created_at) — antes esto usaba
  // updated_at, que no existe en la tabla, así que la query fallaba SIEMPRE
  // (error 42703) y bloqueaba toda cancelación de cualquier usuario. Usa
  // created_at como aproximación: cuenta partidos que este usuario creó y
  // terminaron cancelados en los últimos 30 días.
  const { count, error } = await supabase
    .from(DB_TABLES.matches)
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("match_status", "cancelled")
    .gte("created_at", since);

  if (error) {
    console.error("[checkCancellationLimit]", error);
    return {
      allowed: false,
      reason: "db_error",
      message: "No se pudo validar el límite de cancelaciones. Intentá de nuevo.",
    };
  }

  if ((count ?? 0) >= 5) {
    return {
      allowed: false,
      reason: "rate_limit",
      message: "Alcanzaste el límite de 5 cancelaciones en 30 días. Contactá soporte si es un error.",
    };
  }

  return { allowed: true };
}
