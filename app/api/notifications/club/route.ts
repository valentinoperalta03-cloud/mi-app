import { NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/server";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { clubId?: string; type?: "payment_approved" | "payment_rejected" | "reservation_cancelled"; title?: string; body?: string }
    | null;
  const clubId = String(body?.clubId ?? "").trim();
  const type = body?.type;
  const title = String(body?.title ?? "").trim();
  const text = String(body?.body ?? "").trim();
  if (!clubId || !type || !title || !text) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: club } = await supabase.from(DB_TABLES.clubs).select("owner_id").eq("id", clubId).maybeSingle();
  const ownerId = String((club as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
  if (!ownerId) return NextResponse.json({ ok: true });

  await createNotification(supabase, {
    user_id: ownerId,
    type,
    title,
    body: text,
  });
  return NextResponse.json({ ok: true });
}
