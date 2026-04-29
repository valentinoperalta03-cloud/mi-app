import { DB_TABLES } from "@/lib/db-tables";

type GuardResult = { allowed: true } | { allowed: false; message: string };

export async function checkCancellationLimit(
  supabase: { from: (table: string) => any },
  userId: string
): Promise<GuardResult> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from(DB_TABLES.matches)
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("match_status", "cancelled")
    .gte("updated_at", since);

  if (error) {
    console.error("[checkCancellationLimit]", error);
    return {
      allowed: false,
      message: "No se pudo validar el límite de cancelaciones. Intentá de nuevo.",
    };
  }

  if ((count ?? 0) >= 5) {
    return {
      allowed: false,
      message: "Alcanzaste el límite de 5 cancelaciones en 30 días. Contactá soporte si es un error.",
    };
  }

  return { allowed: true };
}
