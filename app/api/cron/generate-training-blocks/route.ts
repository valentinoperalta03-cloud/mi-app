import { addDays, format } from "date-fns";
import { type NextRequest, NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

function getArgentinaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return new Date(`${y}-${m}-${d}T12:00:00`);
}

function cronSecretFromRequest(req: NextRequest): string | null {
  const bearer = req.headers.get("authorization");
  const bearerSecret =
    bearer?.startsWith("Bearer ") ? bearer.slice("Bearer ".length).trim() : null;
  return (
    req.headers.get("x-cron-secret")?.trim() ??
    req.nextUrl.searchParams.get("secret") ??
    bearerSecret
  );
}

export async function GET(req: NextRequest) {
  const secret = cronSecretFromRequest(req);
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const targetDateObj = addDays(getArgentinaNow(), 7);
  const targetDate = format(targetDateObj, "yyyy-MM-dd");
  const dayOfWeek = targetDateObj.getDay();

  const { data: trainingBlocksRaw } = await supabase
    .from(DB_TABLES.trainingBlocks)
    .select("id,court_id,start_time")
    .eq("is_active", true)
    .eq("day_of_week", dayOfWeek);

  const trainingBlocks = (trainingBlocksRaw ?? []) as Array<{
    id: string;
    court_id: string;
    start_time: string;
  }>;

  let created = 0;
  for (const training of trainingBlocks) {
    const startTime = String(training.start_time).slice(0, 5);
    const logPrefix = `[generate-training-blocks] training=${training.id} fecha=${targetDate}`;

    const { data: existing } = await supabase
      .from(DB_TABLES.courtBlocks)
      .select("id")
      .eq("court_id", training.court_id)
      .eq("blocked_date", targetDate)
      .eq("blocked_time", startTime)
      .eq("reason", "entrenamiento_externo")
      .maybeSingle();
    if (existing) {
      console.log(`${logPrefix}: omitido — ya existe el court_block`);
      continue;
    }

    const { error } = await supabase.from(DB_TABLES.courtBlocks).insert({
      court_id: training.court_id,
      date: targetDate,
      start_time: startTime,
      blocked_date: targetDate,
      blocked_time: startTime,
      reason: "entrenamiento_externo",
    });
    if (error) {
      console.error(`${logPrefix}: NO se pudo crear el court_block — ${error.message}`);
      continue;
    }
    created++;
    console.log(`${logPrefix}: court_block creado OK`);
  }

  return NextResponse.json({ ok: true, targetDate, created });
}
