import { NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

/**
 * El bloqueo del panel (/admin) por grace period vencido ya se evalua en
 * vivo en lib/subscription-gate.ts / lib/subscription-check.ts comparando
 * grace_period_end contra la fecha actual — no depende de este cron.
 *
 * Este cron replica el patron de expire-trials: cuando el grace period de un
 * club en past_due vence, lo desactiva operativamente (is_active=false) para
 * que deje de ser visible en el feed publico de jugadores, sin depender de
 * que Mercado Pago mande otro webhook. deactivation_reason='subscription'
 * permite que un pago posterior aprobado lo reactive automaticamente (ver
 * reactivationPatch en lib/mp-handlers/subscription-webhook-handler.ts).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: expired, error } = await supabase
    .from(DB_TABLES.clubs)
    .update({ is_active: false, deactivation_reason: "subscription" })
    .eq("subscription_status", "past_due")
    .eq("is_active", true)
    .not("grace_period_end", "is", null)
    .lt("grace_period_end", nowIso)
    .select("id, name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    expired: (expired ?? []).length,
    clubs: (expired ?? []).map((c) => (c as { name?: string | null }).name),
  });
}
