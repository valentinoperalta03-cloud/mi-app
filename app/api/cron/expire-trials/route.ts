import { NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  // Clubes que siguen operativos (is_active=true): el vencimiento del trial
  // los oculta de la app del jugador. Se marca deactivation_reason='subscription'
  // para que una reactivacion de MP los pueda restaurar automaticamente
  // (ver lib/mp-handlers/subscription-webhook-handler.ts).
  const { data: expiredOperational, error: operationalError } = await supabase
    .from(DB_TABLES.clubs)
    .update({ subscription_status: "trial_expired", is_active: false, deactivation_reason: "subscription" })
    .eq("subscription_status", "trial")
    .eq("is_active", true)
    .lt("trial_end_date", nowIso)
    .select("id, name");

  if (operationalError) {
    return NextResponse.json({ error: operationalError.message }, { status: 500 });
  }

  // Clubes ya inactivos manualmente (deactivation_reason='manual'): solo se
  // actualiza el estado comercial, is_active se deja intacto para no pisar
  // una baja operativa decidida por el superadmin.
  const { data: expiredAlreadyInactive, error: inactiveError } = await supabase
    .from(DB_TABLES.clubs)
    .update({ subscription_status: "trial_expired" })
    .eq("subscription_status", "trial")
    .eq("is_active", false)
    .lt("trial_end_date", nowIso)
    .select("id, name");

  if (inactiveError) {
    return NextResponse.json({ error: inactiveError.message }, { status: 500 });
  }

  const clubs = [...(expiredOperational ?? []), ...(expiredAlreadyInactive ?? [])];
  return NextResponse.json({
    expired: clubs.length,
    clubs: clubs.map((c) => c.name),
  });
}
