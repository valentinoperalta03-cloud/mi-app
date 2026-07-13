import { NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const url = new URL(req.url);
  const clubId = (url.searchParams.get("clubId") ?? "").trim();
  if (!clubId) {
    return NextResponse.json({ error: "clubId requerido." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: club, error } = await service
    .from(DB_TABLES.clubs)
    .select("owner_id, subscription_status, trial_end_date, next_billing_date")
    .eq("id", clubId)
    .maybeSingle();
  const clubRow = club as {
    owner_id?: string | null;
    subscription_status?: string | null;
    trial_end_date?: string | null;
    next_billing_date?: string | null;
  } | null;

  if (error || !clubRow) {
    return NextResponse.json({ error: "Club no encontrado." }, { status: 404 });
  }
  if (clubRow.owner_id !== user.id) {
    return NextResponse.json({ error: "No tenés permiso sobre este club." }, { status: 403 });
  }

  return NextResponse.json({
    subscriptionStatus: clubRow.subscription_status,
    trialEndDate: clubRow.trial_end_date,
    nextBillingDate: clubRow.next_billing_date,
  });
}
