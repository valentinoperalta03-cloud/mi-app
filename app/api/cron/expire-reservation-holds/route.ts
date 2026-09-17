import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";

/**
 * Respaldo de expiración de reservation_holds — igual que expire-unpaid-matches
 * antes hacía para matches. La garantía real es la expiración perezosa que ya
 * corre en app/(club)/[slug]/actions.ts antes de crear un hold nuevo (ver
 * lib/reservation-hold.ts); este cron solo limpia holds vencidos que nadie
 * volvió a intentar tomar (así no quedan filas 'pending' vencidas ocupando
 * lectura de disponibilidad indefinidamente entre intentos de otros usuarios).
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from(DB_TABLES.reservationHolds)
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    log.error({ event: "cron.expire_reservation_holds.failed", err: error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expired: (data ?? []).length });
}
