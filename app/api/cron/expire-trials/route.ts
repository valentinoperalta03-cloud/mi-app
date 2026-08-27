import { NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from(DB_TABLES.clubs)
    .update({ subscription_status: "trial_expired", is_active: false })
    .eq("subscription_status", "trial")
    .lt("trial_end_date", new Date().toISOString())
    .select("id, name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    expired: data?.length ?? 0,
    clubs: data?.map((c) => c.name),
  });
}
