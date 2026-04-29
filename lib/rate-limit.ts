import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  const service = createServiceClient();
  const now = Date.now();

  const { data: existing, error: readError } = await service
    .from(DB_TABLES.rateLimits)
    .select("key,count,window_start")
    .eq("key", key)
    .maybeSingle();

  if (readError) {
    console.error("[checkRateLimit] read", readError);
    return false;
  }

  if (!existing) {
    const { error: insertError } = await service.from(DB_TABLES.rateLimits).insert({
      key,
      count: 1,
      window_start: new Date(now).toISOString(),
    });
    if (insertError) {
      console.error("[checkRateLimit] insert", insertError);
      return false;
    }
    return true;
  }

  const row = existing as { count: number | null; window_start: string | null };
  const count = Number(row.count ?? 0);
  const windowStartMs = row.window_start ? new Date(row.window_start).getTime() : 0;
  const expired =
    !Number.isFinite(windowStartMs) || now - windowStartMs >= Math.max(1, windowSeconds) * 1000;

  if (expired) {
    const { error: resetError } = await service
      .from(DB_TABLES.rateLimits)
      .update({ count: 1, window_start: new Date(now).toISOString() })
      .eq("key", key);
    if (resetError) {
      console.error("[checkRateLimit] reset", resetError);
      return false;
    }
    return true;
  }

  if (count >= maxRequests) {
    return false;
  }

  const { error: incError } = await service
    .from(DB_TABLES.rateLimits)
    .update({ count: count + 1 })
    .eq("key", key);
  if (incError) {
    console.error("[checkRateLimit] increment", incError);
    return false;
  }
  return true;
}
